<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class IncomeAccrualService
{
    /**
     * Sum of accrued (unclaimed) staking rewards across active/completed platform stakes.
     */
    public function totalAccruedUsd(User $user): string
    {
        $sum = Investment::query()
            ->where('user_id', $user->id)
            ->whereIn('status', [
                Investment::STATUS_ACTIVE,
                Investment::STATUS_COMPLETED,
                Investment::STATUS_UNLOCKING,
                Investment::STATUS_UNLOCKED,
            ])
            ->sum('accrued_reward_usd');

        return number_format((float) $sum, 4, '.', '');
    }

    /**
     * @return array{
     *     accrued_reward_usd: string,
     *     virtual_income_usd: string,
     *     can_claim: bool,
     *     next_claim_at: string|null,
     *     claim_interval_hours: int
     * }
     */
    public function summaryForUser(User $user, WalletBalanceService $wallets): array
    {
        $interval = max(1, (int) config('income.claim.interval_hours', 24));
        $accrued = $this->totalAccruedUsd($user);
        $virtual = app(VirtualIncomeWalletService::class)->availableBalance($user);
        $next = $user->last_income_claim_at?->copy()->addHours($interval);

        $canClaim = bccomp($accrued, '0.0001', 4) > 0
            && ($next === null || now()->greaterThanOrEqualTo($next));

        return [
            'accrued_reward_usd' => $accrued,
            'virtual_income_usd' => $virtual,
            'can_claim' => $canClaim,
            'next_claim_at' => ($next !== null && now()->lt($next)) ? $next->toIso8601String() : null,
            'claim_interval_hours' => $interval,
        ];
    }

    /**
     * @return array<int, string> investment_id => accrued_usd
     */
    public function accruedByInvestment(int $userId, array $investmentIds): array
    {
        if ($investmentIds === []) {
            return [];
        }

        $rows = Investment::query()
            ->where('user_id', $userId)
            ->whereIn('id', $investmentIds)
            ->get(['id', 'accrued_reward_usd']);

        $out = [];
        foreach ($rows as $row) {
            $out[(int) $row->id] = number_format((float) $row->accrued_reward_usd, 4, '.', '');
        }

        return $out;
    }

    public function addAccrued(Investment $investment, string $amountUsd): void
    {
        $add = number_format((float) $amountUsd, 4, '.', '');
        if (bccomp($add, '0', 4) <= 0) {
            return;
        }

        DB::transaction(function () use ($investment, $add) {
            $inv = Investment::query()->whereKey($investment->id)->lockForUpdate()->firstOrFail();
            $newAccrued = bcadd(number_format((float) $inv->accrued_reward_usd, 4, '.', ''), $add, 4);
            $inv->forceFill(['accrued_reward_usd' => $newAccrued])->save();
        });
    }
}
