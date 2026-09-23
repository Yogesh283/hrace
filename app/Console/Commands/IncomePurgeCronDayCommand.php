<?php

namespace App\Console\Commands;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\WalletBalanceService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class IncomePurgeCronDayCommand extends Command
{
    protected $signature = 'income:purge-cron-day
                            {--date= : Calendar day YYYY-MM-DD (defaults to today)}
                            {--types=leadership,roi : Comma list: leadership,roi}
                            {--yes : Skip confirmation}';

    protected $description = 'TEST ONLY: Delete cron-released income for a calendar day and recalculate wallets so admin can re-run jobs.';

    public function handle(WalletBalanceService $wallets): int
    {
        $date = $this->option('date');
        if (! is_string($date) || $date === '') {
            $date = Carbon::now()->format('Y-m-d');
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $this->error('Invalid --date; use YYYY-MM-DD.');

            return self::FAILURE;
        }

        $types = collect(explode(',', (string) $this->option('types')))
            ->map(fn ($t) => strtolower(trim($t)))
            ->filter()
            ->unique()
            ->values();

        if ($types->isEmpty()) {
            $this->error('Pass --types=leadership and/or roi.');

            return self::FAILURE;
        }

        $rows = collect();
        if ($types->contains('leadership')) {
            $rows = $rows->concat($this->leadershipRowsForDate($date));
        }
        if ($types->contains('roi')) {
            $rows = $rows->concat($this->roiRowsForDate($date));
        }

        $rows = $rows->unique('id')->values();
        if ($rows->isEmpty()) {
            $this->info("No cron income ledger rows found for {$date} (types: ".$types->implode(', ').').');

            return self::SUCCESS;
        }

        $sum = number_format((float) $rows->sum(fn (LedgerEntry $r) => (float) $r->amount_usd), 2);
        $this->warn("Will delete {$rows->count()} ledger row(s) for {$date} totaling \${$sum}.");
        $this->table(
            ['id', 'user_id', 'entry_type', 'amount_usd', 'reference_type'],
            $rows->take(30)->map(fn (LedgerEntry $r) => [
                $r->id,
                $r->user_id,
                $r->entry_type,
                $r->amount_usd,
                $r->reference_type,
            ])->all(),
        );
        if ($rows->count() > 30) {
            $this->line('… and '.($rows->count() - 30).' more');
        }

        if (! $this->option('yes') && ! $this->confirm('Delete these rows, roll back ROI counters if needed, and recalculate wallets?', false)) {
            return self::SUCCESS;
        }

        $roiRows = $rows->filter(fn (LedgerEntry $r) => in_array($r->entry_type, [
            LedgerEntry::TYPE_ROI_DAILY,
            LedgerEntry::TYPE_ROI_MONTHLY,
        ], true))->values();

        DB::transaction(function () use ($rows, $roiRows): void {
            $this->rollbackInvestmentsAfterRoiDeletion($roiRows);
            LedgerEntry::query()->whereIn('id', $rows->pluck('id')->all())->delete();
        });

        foreach ($rows->pluck('user_id')->unique() as $uid) {
            $user = User::query()->find($uid);
            if ($user) {
                $bal = $wallets->recalculateFromLedger($user);
                $this->line("User #{$uid} wallet: \${$bal}");
            }
        }

        $this->info("Purged cron income for {$date}. You can run income jobs again for testing.");

        return self::SUCCESS;
    }

    /**
     * @return Collection<int, LedgerEntry>
     */
    private function leadershipRowsForDate(string $date): Collection
    {
        $referenceId = (int) str_replace('-', '', $date);

        return LedgerEntry::query()
            ->whereIn('entry_type', [
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
            ])
            ->where('reference_type', 'community_leadership_day')
            ->where('reference_id', $referenceId)
            ->orderBy('id')
            ->get();
    }

    /**
     * @return Collection<int, LedgerEntry>
     */
    private function roiRowsForDate(string $date): Collection
    {
        $start = Carbon::parse($date)->startOfDay();
        $end = Carbon::parse($date)->endOfDay();

        $roi = LedgerEntry::query()
            ->whereIn('entry_type', [
                LedgerEntry::TYPE_ROI_DAILY,
                LedgerEntry::TYPE_ROI_MONTHLY,
            ])
            ->whereBetween('created_at', [$start, $end])
            ->orderBy('id')
            ->get();

        $network = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->whereBetween('created_at', [$start, $end])
            ->orderBy('id')
            ->get();

        return $roi->concat($network)->values();
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
            $flexible = $duration === 0;
            $completed = ! $flexible && $duration > 0 && $newDone >= $duration;

            $nextAt = $inv->next_roi_at;
            if ($nextAt) {
                $nextAt = $nextAt->copy()->subDays($count);
            } else {
                $nextAt = now();
            }

            $inv->forceFill([
                'roi_payouts_done' => $newDone,
                'total_roi_paid_usd' => $newTotal,
                'status' => $completed ? Investment::STATUS_COMPLETED : Investment::STATUS_ACTIVE,
                'next_roi_at' => $completed ? null : $nextAt,
                'holding_completed_at' => $completed ? $inv->holding_completed_at : null,
            ])->save();
        }
    }
}
