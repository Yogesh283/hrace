<?php

namespace App\Console\Commands;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\WalletBalanceService;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class IncomeReverseRoiCommand extends Command
{
    protected $signature = 'income:reverse-roi
                            {--scope=bonza-network : bonza-network = remove network ROI wrongly paid on Bonza bonus; full = remove all roi_daily/roi_monthly + all affiliate_network_roi and roll back investments}
                            {--user= : Limit to earner user id (network rows) or ROI recipient (full scope)}
                            {--dry-run : Preview without deleting}
                            {--yes : Skip confirmation prompts}
                            {--force : Required for scope=full}';

    protected $description = 'Reverse ROI ledger payouts (wrong Bonza-triggered network ROI, or full daily ROI + network reset)';

    public function handle(WalletBalanceService $wallets): int
    {
        $scope = (string) $this->option('scope');
        $dryRun = (bool) $this->option('dry-run');
        $userId = $this->option('user') !== null ? (int) $this->option('user') : null;

        return match ($scope) {
            'bonza-network' => $this->reverseBonzaTriggeredNetworkRoi($wallets, $userId, $dryRun),
            'full' => $this->reverseFullDailyRoiAndNetwork($wallets, $userId, $dryRun),
            default => $this->fail("Unknown scope \"{$scope}\". Use bonza-network or full."),
        };
    }

    private function reverseBonzaTriggeredNetworkRoi(WalletBalanceService $wallets, ?int $userId, bool $dryRun): int
    {
        $query = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->where('meta->source_roi_entry_type', LedgerEntry::TYPE_BONZA_DIRECT_BONUS);

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $rows = $query->orderBy('id')->get();
        if ($rows->isEmpty()) {
            $this->info('No affiliate_network_roi rows with source bonza_direct_bonus found.');

            return self::SUCCESS;
        }

        $sum = $rows->sum(fn (LedgerEntry $r) => (float) $r->amount_usd);
        $this->warn('Bonza-triggered network ROI (should not exist): '.$rows->count().' row(s), $'.number_format($sum, 4));

        $this->table(
            ['id', 'user_id', 'amount_usd', 'reference_id', 'level', 'from_user_id'],
            $rows->map(fn (LedgerEntry $r) => [
                $r->id,
                $r->user_id,
                $r->amount_usd,
                $r->reference_id,
                is_array($r->meta) ? ($r->meta['network_level'] ?? '') : '',
                is_array($r->meta) ? ($r->meta['from_user_id'] ?? '') : '',
            ])->all(),
        );

        if ($dryRun) {
            $this->comment('Dry run — no rows deleted. Run without --dry-run to apply.');

            return self::SUCCESS;
        }

        if (! $this->option('yes') && ! $this->confirm('Delete these network ROI rows and recalculate affected wallets?', true)) {
            return self::SUCCESS;
        }

        $this->deleteRowsAndRecalculateWallets($rows, $wallets);
        $this->info('Bonza-triggered network ROI reversed. Member Bonza bonuses (bonza_direct_bonus) unchanged.');

        return self::SUCCESS;
    }

    private function reverseFullDailyRoiAndNetwork(WalletBalanceService $wallets, ?int $userId, bool $dryRun): int
    {
        if (! $this->option('force')) {
            $this->error('scope=full removes ALL roi_daily / roi_monthly and ALL affiliate_network_roi. Pass --force to confirm.');

            return self::FAILURE;
        }

        $roiQuery = LedgerEntry::query()->whereIn('entry_type', [
            LedgerEntry::TYPE_ROI_DAILY,
            LedgerEntry::TYPE_ROI_MONTHLY,
        ]);

        $networkQuery = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI);

        if ($userId !== null) {
            $roiQuery->where('user_id', $userId);
            $networkQuery->where('user_id', $userId);
        }

        $roiRows = $roiQuery->orderBy('id')->get();
        $networkRows = $networkQuery->orderBy('id')->get();
        $allRows = $roiRows->concat($networkRows);

        if ($allRows->isEmpty()) {
            $this->info('No roi_daily / roi_monthly / affiliate_network_roi rows to reverse.');

            return self::SUCCESS;
        }

        $this->warn('Full reverse:');
        $this->line('  roi_daily/monthly: '.$roiRows->count().' row(s), $'.number_format((float) $roiRows->sum('amount_usd'), 2));
        $this->line('  affiliate_network_roi: '.$networkRows->count().' row(s), $'.number_format((float) $networkRows->sum('amount_usd'), 4));

        if ($dryRun) {
            $this->comment('Dry run — investments and wallets not changed.');

            return self::SUCCESS;
        }

        if (! $this->option('yes') && ! $this->confirm('Delete all listed rows, roll back investment ROI counters, and recalculate wallets?', false)) {
            return self::SUCCESS;
        }

        DB::transaction(function () use ($roiRows, $allRows, $wallets) {
            $this->rollbackInvestmentsAfterRoiDeletion($roiRows);
            $this->deleteRowsById($allRows->pluck('id')->all());
        });

        $userIds = $allRows->pluck('user_id')->unique();
        foreach ($userIds as $uid) {
            $user = User::query()->find($uid);
            if ($user) {
                $bal = $wallets->recalculateFromLedger($user);
                $this->line("User #{$uid} wallet recalculated: \${$bal}");
            }
        }

        $this->info('Daily/monthly ROI and all network-of-ROI reversed. bonza_direct_bonus rows kept.');

        return self::SUCCESS;
    }

    /**
     * @param  Collection<int, LedgerEntry>  $roiRows
     */
    private function rollbackInvestmentsAfterRoiDeletion(Collection $roiRows): void
    {
        $byInvestment = $roiRows
            ->filter(fn (LedgerEntry $r) => $r->reference_type === 'investment' && $r->reference_id)
            ->groupBy('reference_id');

        foreach ($byInvestment as $investmentId => $entries) {
            $inv = Investment::query()->whereKey((int) $investmentId)->lockForUpdate()->first();
            if (! $inv) {
                continue;
            }

            $dailySum = '0.00';
            foreach ($entries as $entry) {
                $dailySum = bcadd($dailySum, (string) $entry->amount_usd, 2);
            }
            $count = $entries->count();

            $newDone = max(0, (int) $inv->roi_payouts_done - $count);
            $newTotal = bcsub((string) $inv->total_roi_paid_usd, $dailySum, 2);
            if (bccomp($newTotal, '0', 2) < 0) {
                $newTotal = '0.00';
            }

            $duration = (int) $inv->duration_days;
            $completed = $duration > 0 && $newDone >= $duration;

            $nextAt = $inv->next_roi_at;
            if (! $completed && $duration > 0) {
                $nextAt = now();
            }

            $inv->forceFill([
                'roi_payouts_done' => $newDone,
                'total_roi_paid_usd' => $newTotal,
                'status' => $completed ? Investment::STATUS_COMPLETED : Investment::STATUS_ACTIVE,
                'next_roi_at' => $completed ? null : $nextAt,
            ])->save();
        }
    }

    /**
     * @param  Collection<int, LedgerEntry>  $rows
     */
    private function deleteRowsAndRecalculateWallets(Collection $rows, WalletBalanceService $wallets): void
    {
        $ids = $rows->pluck('id')->all();
        $userIds = $rows->pluck('user_id')->unique();

        DB::transaction(function () use ($ids) {
            $this->deleteRowsById($ids);
        });

        foreach ($userIds as $uid) {
            $user = User::query()->find($uid);
            if ($user) {
                $bal = $wallets->recalculateFromLedger($user);
                $this->line("User #{$uid} wallet recalculated: \${$bal}");
            }
        }
    }

    /**
     * @param  list<int>  $ids
     */
    private function deleteRowsById(array $ids): void
    {
        if ($ids === []) {
            return;
        }

        LedgerEntry::query()->whereIn('id', $ids)->delete();
    }
}
