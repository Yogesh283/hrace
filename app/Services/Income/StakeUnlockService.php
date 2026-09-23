<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Models\StakeUnlock;
use App\Models\StakeUnlockEmi;
use App\Models\User;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StakeUnlockService
{
    public function __construct(
        protected LedgerWriter $ledger,
        protected CompanyReserveLedger $companyReserve,
    ) {}

    /**
     * Start stake principal unlock:
     * Default: 10% → admin wallet immediately, 90% → 3 EMIs of 30% each.
     * Flexible held ≥ 10 days: 0% fee, full principal in equal EMIs.
     */
    public function startUnlock(Investment $investment): StakeUnlock
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        return DB::transaction(function () use ($investment) {
            $inv = Investment::query()->whereKey($investment->id)->lockForUpdate()->firstOrFail();

            if ($inv->stakeUnlock()->exists()) {
                return $inv->stakeUnlock()->with('emis')->firstOrFail();
            }

            if (! $this->canUnlock($inv)) {
                throw ValidationException::withMessages([
                    'investment' => __('This stake is not ready to unlock yet.'),
                ]);
            }

            $cfg = RewardPlan::stakeUnlockRules();
            $principal = number_format((float) $inv->amount_usd, 2, '.', '');
            $adminFeePct = number_format(RewardPlan::stakeUnlockAdminFeePercentFor($inv), 4, '.', '');
            $emiPct = number_format((float) $cfg['emi_percent_each'], 4, '.', '');
            $emiCount = (int) $cfg['emi_count'];
            $intervalDays = max(1, (int) $cfg['interval_days']);
            $feeFree = bccomp($adminFeePct, '0', 4) === 0;

            $adminFee = bcmul($principal, bcdiv($adminFeePct, '100', 8), 2);
            $emiPool = bcsub($principal, $adminFee, 2);

            // With fee: each EMI = emi_percent of principal (last adjusted to pool).
            // Fee-free Flexible: equal split of full principal across EMIs.
            $emiAmounts = [];
            $allocated = '0.00';
            if ($feeFree) {
                $equal = bcdiv($emiPool, (string) $emiCount, 2);
                for ($i = 1; $i <= $emiCount; $i++) {
                    if ($i === $emiCount) {
                        $emiAmounts[$i] = bcsub($emiPool, $allocated, 2);
                    } else {
                        $emiAmounts[$i] = $equal;
                        $allocated = bcadd($allocated, $equal, 2);
                    }
                }
            } else {
                $emiAmount = bcmul($principal, bcdiv($emiPct, '100', 8), 2);
                for ($i = 1; $i <= $emiCount; $i++) {
                    if ($i === $emiCount) {
                        $emiAmounts[$i] = bcsub($emiPool, $allocated, 2);
                    } else {
                        $emiAmounts[$i] = $emiAmount;
                        $allocated = bcadd($allocated, $emiAmount, 2);
                    }
                }
            }

            $now = now();
            $adminWallet = SiteSetting::treasuryAddress();
            $heldDays = $inv->created_at ? $inv->created_at->diffInDays($now) : 0;

            $unlock = StakeUnlock::query()->create([
                'user_id' => $inv->user_id,
                'investment_id' => $inv->id,
                'principal_usd' => $principal,
                'admin_fee_usd' => $adminFee,
                'emi_pool_usd' => $emiPool,
                'status' => StakeUnlock::STATUS_ACTIVE,
                'unlocked_at' => $now,
            ]);

            if (bccomp($adminFee, '0', 2) > 0) {
                $this->ledger->record(
                    $this->companyReserve->user(),
                    LedgerEntry::TYPE_STAKE_UNLOCK_ADMIN_FEE,
                    $adminFee,
                    'stake_unlock',
                    $unlock->id,
                    [
                        'investment_id' => $inv->id,
                        'from_user_id' => $inv->user_id,
                        'principal_usd' => $principal,
                        'admin_wallet_bep20' => $adminWallet,
                        'network' => SiteSetting::treasuryNetworkLabel(),
                        'held_days' => $heldDays,
                    ],
                );
            }

            for ($i = 1; $i <= $emiCount; $i++) {
                StakeUnlockEmi::query()->create([
                    'stake_unlock_id' => $unlock->id,
                    'user_id' => $inv->user_id,
                    'emi_number' => $i,
                    'amount_usd' => $emiAmounts[$i],
                    'due_at' => $now->copy()->addDays($intervalDays * $i),
                    'status' => StakeUnlockEmi::STATUS_PENDING,
                ]);
            }

            $inv->forceFill([
                'status' => Investment::STATUS_UNLOCKING,
                'next_roi_at' => null,
                'holding_completed_at' => null,
            ])->save();

            return $unlock->load('emis');
        });
    }

    public function canUnlock(Investment $inv): bool
    {
        if ($inv->stakeUnlock()->exists()) {
            return false;
        }

        if (in_array($inv->status, [Investment::STATUS_UNLOCKING, Investment::STATUS_UNLOCKED], true)) {
            return false;
        }

        $duration = (int) $inv->duration_days;

        // Flexible: user may unlock anytime while active/completed.
        if ($duration === 0) {
            return in_array($inv->status, [Investment::STATUS_ACTIVE, Investment::STATUS_COMPLETED], true);
        }

        // Fixed lock: ROI days finished or calendar lock elapsed.
        if ($inv->status === Investment::STATUS_COMPLETED) {
            return true;
        }

        if ($inv->status === Investment::STATUS_ACTIVE) {
            $done = (int) $inv->roi_payouts_done;
            if ($done >= $duration) {
                return true;
            }

            return $inv->created_at !== null
                && $inv->created_at->copy()->addDays($duration)->isPast();
        }

        return false;
    }

    /**
     * Credit due EMIs to member wallet.
     *
     * @return int Number of EMIs paid
     */
    public function releaseDueEmis(?int $limit = 500): int
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        $paid = 0;
        $query = StakeUnlockEmi::query()
            ->where('status', StakeUnlockEmi::STATUS_PENDING)
            ->where('due_at', '<=', now())
            ->orderBy('id')
            ->limit($limit ?? 500);

        foreach ($query->get() as $emi) {
            if ($this->payEmi($emi)) {
                $paid++;
            }
        }

        return $paid;
    }

    public function payEmi(StakeUnlockEmi $emi): bool
    {
        return DB::transaction(function () use ($emi) {
            $row = StakeUnlockEmi::query()->whereKey($emi->id)->lockForUpdate()->first();
            if (! $row || $row->status !== StakeUnlockEmi::STATUS_PENDING) {
                return false;
            }

            if ($row->due_at->isFuture()) {
                return false;
            }

            $user = User::query()->whereKey($row->user_id)->lockForUpdate()->firstOrFail();
            $amount = number_format((float) $row->amount_usd, 2, '.', '');
            if (bccomp($amount, '0', 2) <= 0) {
                $row->forceFill([
                    'status' => StakeUnlockEmi::STATUS_PAID,
                    'paid_at' => now(),
                ])->save();

                $this->maybeCompleteUnlock($row->stake_unlock_id);

                return true;
            }

            $already = LedgerEntry::query()
                ->where('entry_type', LedgerEntry::TYPE_STAKE_UNLOCK_EMI)
                ->where('reference_type', 'stake_unlock_emi')
                ->where('reference_id', $row->id)
                ->exists();
            if ($already) {
                $row->forceFill([
                    'status' => StakeUnlockEmi::STATUS_PAID,
                    'paid_at' => now(),
                ])->save();
                $this->maybeCompleteUnlock($row->stake_unlock_id);

                return true;
            }

            $this->ledger->record(
                $user,
                LedgerEntry::TYPE_STAKE_UNLOCK_EMI,
                $amount,
                'stake_unlock_emi',
                $row->id,
                [
                    'stake_unlock_id' => $row->stake_unlock_id,
                    'emi_number' => $row->emi_number,
                    'due_at' => $row->due_at?->toIso8601String(),
                ],
            );

            $row->forceFill([
                'status' => StakeUnlockEmi::STATUS_PAID,
                'paid_at' => now(),
            ])->save();

            $this->maybeCompleteUnlock($row->stake_unlock_id);

            return true;
        });
    }

    private function maybeCompleteUnlock(int $stakeUnlockId): void
    {
        $unlock = StakeUnlock::query()->whereKey($stakeUnlockId)->lockForUpdate()->first();
        if (! $unlock || $unlock->status === StakeUnlock::STATUS_COMPLETED) {
            return;
        }

        $pending = StakeUnlockEmi::query()
            ->where('stake_unlock_id', $unlock->id)
            ->where('status', StakeUnlockEmi::STATUS_PENDING)
            ->exists();

        if ($pending) {
            return;
        }

        $unlock->forceFill(['status' => StakeUnlock::STATUS_COMPLETED])->save();
        Investment::query()->whereKey($unlock->investment_id)->update([
            'status' => Investment::STATUS_UNLOCKED,
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function schedulePayloadForUser(int $userId): array
    {
        return StakeUnlock::query()
            ->with(['emis', 'investment:id,amount_usd,duration_days,status'])
            ->where('user_id', $userId)
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(static function (StakeUnlock $unlock) {
                return [
                    'id' => $unlock->id,
                    'investment_id' => $unlock->investment_id,
                    'principal_usd' => number_format((float) $unlock->principal_usd, 2, '.', ''),
                    'admin_fee_usd' => number_format((float) $unlock->admin_fee_usd, 2, '.', ''),
                    'emi_pool_usd' => number_format((float) $unlock->emi_pool_usd, 2, '.', ''),
                    'status' => $unlock->status,
                    'unlocked_at' => $unlock->unlocked_at?->toIso8601String(),
                    'emis' => $unlock->emis->map(static fn (StakeUnlockEmi $emi) => [
                        'emi_number' => $emi->emi_number,
                        'amount_usd' => number_format((float) $emi->amount_usd, 2, '.', ''),
                        'due_at' => $emi->due_at?->toIso8601String(),
                        'paid_at' => $emi->paid_at?->toIso8601String(),
                        'status' => $emi->status,
                        'label' => 'EMI '.$emi->emi_number.' · 30%',
                    ])->values()->all(),
                ];
            })
            ->values()
            ->all();
    }
}
