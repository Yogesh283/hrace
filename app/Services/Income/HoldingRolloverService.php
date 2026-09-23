<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;

/**
 * T&C: if stake principal is not unlocked after holding period ends,
 * auto-rollover into the same lock cycle within rollover_hours (default 24h).
 */
class HoldingRolloverService
{
    public function rolloverDue(?int $limit = 200): int
    {
        if (! RewardPlan::holdingRolloverEnabled()) {
            return 0;
        }

        $hours = RewardPlan::holdingRolloverHours();
        $deadline = now()->subHours($hours);
        $count = 0;

        Investment::query()
            ->where('status', Investment::STATUS_COMPLETED)
            ->where('duration_days', '>', 0)
            ->whereNotNull('holding_completed_at')
            ->where('holding_completed_at', '<=', $deadline)
            ->whereDoesntHave('stakeUnlock')
            ->orderBy('id')
            ->limit($limit ?? 200)
            ->get()
            ->each(function (Investment $investment) use (&$count) {
                if ($this->rollover($investment)) {
                    $count++;
                }
            });

        return $count;
    }

    public function rollover(Investment $investment): bool
    {
        if (! RewardPlan::holdingRolloverEnabled()) {
            return false;
        }

        return DB::transaction(function () use ($investment) {
            $inv = Investment::query()->whereKey($investment->id)->lockForUpdate()->first();
            if (! $inv || $inv->status !== Investment::STATUS_COMPLETED) {
                return false;
            }

            if ((int) $inv->duration_days <= 0) {
                return false;
            }

            if ($inv->stakeUnlock()->exists()) {
                return false;
            }

            $hours = RewardPlan::holdingRolloverHours();
            if ($inv->holding_completed_at === null || $inv->holding_completed_at->copy()->addHours($hours)->isFuture()) {
                return false;
            }

            $inv->forceFill([
                'status' => Investment::STATUS_ACTIVE,
                'roi_payouts_done' => 0,
                'next_roi_at' => now(),
                'holding_completed_at' => null,
                'rollover_count' => (int) $inv->rollover_count + 1,
            ])->save();

            return true;
        });
    }
}
