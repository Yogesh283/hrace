<?php

namespace App\Console\Commands;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Services\Income\AffiliateNetworkRoiService;
use App\Services\Income\IncomeAccrualService;
use App\Services\Income\LedgerWriter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IncomePayRoiCommand extends Command
{
    protected $signature = 'income:pay-roi {--force-due : TESTING — mark all active stakes due now, then pay (allows multiple runs in one day)}';

    protected $description = 'Pay participation reward rates + Level-1 ROI sharing (10% of direct ROI).';

    public function handle(LedgerWriter $ledger, AffiliateNetworkRoiService $roiSharing): int
    {
        \App\Support\IncomeVaultFinancialAuthority::assertVirtualWalletMutationAllowed();

        if (config('income_vault.settlement_required')) {
            $this->error('STOP: INCOME_VAULT_SETTLEMENT_REQUIRED — ROI must settle via RaceIncomeVault pipeline.');

            return self::FAILURE;
        }

        if (config('participation_contract.on_chain.enabled')) {
            $this->info('Skipped: participation rewards are distributed on-chain by RaceParticipation.sol.');

            return self::SUCCESS;
        }

        if ($this->option('force-due')) {
            $n = Investment::query()
                ->where('status', Investment::STATUS_ACTIVE)
                ->whereNotNull('next_roi_at')
                ->update(['next_roi_at' => now()]);
            $this->warn("TESTING force-due: marked {$n} active stake(s) due now.");
        }

        Investment::query()
            ->where('status', Investment::STATUS_ACTIVE)
            ->whereNotNull('next_roi_at')
            ->where('next_roi_at', '<=', now())
            ->orderBy('id')
            ->each(function (Investment $investment) use ($ledger, $roiSharing) {
                DB::transaction(function () use ($investment, $ledger, $roiSharing) {
                    $inv = Investment::query()->whereKey($investment->id)->lockForUpdate()->first();
                    if (! $inv || $inv->status !== Investment::STATUS_ACTIVE || ! $inv->next_roi_at || $inv->next_roi_at->isFuture()) {
                        return;
                    }

                    if ($inv->roi_percent_daily !== null && $inv->duration_days !== null) {
                        if (bccomp((string) $inv->roi_percent_daily, '0', 4) <= 0) {
                            return;
                        }
                        $this->accrueParticipationDailyReward($inv, $ledger, $roiSharing);
                    } else {
                        $this->accrueLegacyMonthlyRoi($inv, $ledger, $roiSharing);
                    }
                });
            });

        $this->info('Participation reward accrual complete.');

        return self::SUCCESS;
    }

    private function accrueParticipationDailyReward(
        Investment $inv,
        LedgerWriter $ledger,
        AffiliateNetworkRoiService $roiSharing,
    ): void {
        while ($inv->next_roi_at
            && ! $inv->next_roi_at->isFuture()
            && $inv->status === Investment::STATUS_ACTIVE) {
            $need = (int) $inv->duration_days;
            $done = (int) $inv->roi_payouts_done;
            $flexible = $need === 0;

            if (! $flexible && ($need <= 0 || $done >= $need)) {
                $inv->forceFill([
                    'status' => Investment::STATUS_COMPLETED,
                    'next_roi_at' => null,
                    'holding_completed_at' => $inv->holding_completed_at ?? now(),
                ])->save();

                return;
            }

            $user = $inv->user()->lockForUpdate()->first();
            if (! $user || $user->is_blocked) {
                return;
            }

            $principal = (string) $inv->amount_usd;
            $dailyPct = (string) $inv->roi_percent_daily;
            $rate = bcdiv($dailyPct, '100', 8);
            $pay = bcmul($principal, $rate, 4);
            if (bccomp($pay, '0', 4) <= 0) {
                return;
            }

            $ledger->recordAccrual(
                $user,
                LedgerEntry::TYPE_ROI_ACCRUAL,
                $pay,
                'investment',
                $inv->id,
                [
                    'roi_percent_daily' => $dailyPct,
                    'duration_days' => $need,
                    'flexible' => $flexible,
                    'payout_index' => $done + 1,
                ],
            );

            app(IncomeAccrualService::class)->addAccrued($inv, $pay);

            $roiSharing->onRoiCreditedToUser($user, $pay, $inv->id, LedgerEntry::TYPE_ROI_ACCRUAL);

            $done++;
            $completed = ! $flexible && $done >= $need;
            $newTotal = bcadd((string) $inv->total_roi_paid_usd, $pay, 2);

            $inv->forceFill([
                'roi_payouts_done' => $done,
                'total_roi_paid_usd' => $newTotal,
                'status' => $completed ? Investment::STATUS_COMPLETED : Investment::STATUS_ACTIVE,
                'next_roi_at' => $completed ? null : $inv->next_roi_at->copy()->addDay(),
                'holding_completed_at' => $completed ? ($inv->holding_completed_at ?? now()) : $inv->holding_completed_at,
            ])->save();

            if ($completed) {
                return;
            }
        }
    }

    private function accrueLegacyMonthlyRoi(
        Investment $inv,
        LedgerWriter $ledger,
        AffiliateNetworkRoiService $roiSharing,
    ): void {
        $user = $inv->user()->lockForUpdate()->first();
        if (! $user || $user->is_blocked || $user->participation_activated_at === null) {
            return;
        }

        $principal = (string) $inv->amount_usd;
        $cap = bcmul($principal, (string) $inv->cap_multiplier, 2);
        $remaining = bcsub($cap, (string) $inv->total_roi_paid_usd, 2);
        if (bccomp($remaining, '0', 2) <= 0) {
            $inv->forceFill([
                'status' => Investment::STATUS_COMPLETED,
                'next_roi_at' => null,
                'holding_completed_at' => $inv->holding_completed_at ?? now(),
            ])->save();

            return;
        }

        $monthlyRate = bcdiv((string) $inv->roi_percent_monthly, '100', 6);
        $monthlyPay = bcmul($principal, $monthlyRate, 2);
        $pay = bccomp($monthlyPay, $remaining, 2) <= 0 ? $monthlyPay : $remaining;

        if (bccomp($pay, '0', 2) <= 0) {
            return;
        }

        $ledger->recordAccrual(
            $user,
            LedgerEntry::TYPE_ROI_ACCRUAL,
            $pay,
            'investment',
            $inv->id,
            ['roi_percent_monthly' => (string) $inv->roi_percent_monthly],
        );

        app(IncomeAccrualService::class)->addAccrued($inv, $pay);

        $roiSharing->onRoiCreditedToUser($user, $pay, $inv->id, LedgerEntry::TYPE_ROI_ACCRUAL);

        $newTotal = bcadd((string) $inv->total_roi_paid_usd, $pay, 2);
        $completed = bccomp($newTotal, $cap, 2) >= 0;

        $inv->forceFill([
            'total_roi_paid_usd' => $newTotal,
            'status' => $completed ? Investment::STATUS_COMPLETED : Investment::STATUS_ACTIVE,
            'next_roi_at' => $completed ? null : $inv->next_roi_at->copy()->addMonth(),
            'holding_completed_at' => $completed
                ? ($inv->holding_completed_at ?? now())
                : $inv->holding_completed_at,
        ])->save();
    }
}
