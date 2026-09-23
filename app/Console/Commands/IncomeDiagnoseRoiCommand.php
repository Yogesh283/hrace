<?php

namespace App\Console\Commands;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use Illuminate\Console\Command;

class IncomeDiagnoseRoiCommand extends Command
{
    protected $signature = 'income:diagnose-roi {--user= : Filter by user id}';

    protected $description = 'Show which investments are due for daily ROI (no tinker needed).';

    public function handle(): int
    {
        $userId = $this->option('user');
        $userFilter = is_numeric($userId) ? (int) $userId : null;

        $base = Investment::query()->when($userFilter, fn ($q) => $q->where('user_id', $userFilter));

        $active = (clone $base)->where('status', Investment::STATUS_ACTIVE)->count();
        $due = (clone $base)
            ->where('status', Investment::STATUS_ACTIVE)
            ->whereNotNull('next_roi_at')
            ->where('next_roi_at', '<=', now())
            ->count();
        $waiting = (clone $base)
            ->where('status', Investment::STATUS_ACTIVE)
            ->whereNotNull('next_roi_at')
            ->where('next_roi_at', '>', now())
            ->count();
        $noSchedule = (clone $base)
            ->where('status', Investment::STATUS_ACTIVE)
            ->whereNull('next_roi_at')
            ->count();
        $roiDailyPaid = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_ROI_DAILY)
            ->when($userFilter, fn ($q) => $q->where('user_id', $userFilter))
            ->count();

        $this->info('Daily ROI diagnose');
        $this->newLine();
        $this->table(
            ['Metric', 'Count'],
            [
                ['Active investments', (string) $active],
                ['Due now (will pay on income:pay-roi)', (string) $due],
                ['Waiting (next_roi_at in future)', (string) $waiting],
                ['Active but no next_roi_at', (string) $noSchedule],
                ['Ledger rows (roi_daily)', (string) $roiDailyPaid],
            ],
        );

        if ($due === 0) {
            $this->newLine();
            $this->warn('Nothing due right now — income:pay-roi will not credit anyone.');
            $this->line('Common causes: next_roi_at is tomorrow, user blocked, or roi_payouts_done >= duration_days.');
        }

        $this->newLine();
        $this->line('Next 15 active investments:');

        $rows = (clone $base)
            ->where('status', Investment::STATUS_ACTIVE)
            ->with(['user:id,is_blocked'])
            ->orderBy('id')
            ->limit(15)
            ->get();

        if ($rows->isEmpty()) {
            $this->comment('No active investments.');

            return self::SUCCESS;
        }

        $tableRows = [];
        foreach ($rows as $inv) {
            $dueNow = $inv->next_roi_at && $inv->next_roi_at->lte(now());
            $blocked = (bool) ($inv->user?->is_blocked);
            $tableRows[] = [
                'id' => (string) $inv->id,
                'user' => (string) $inv->user_id,
                'amount' => (string) $inv->amount_usd,
                'daily%' => (string) ($inv->roi_percent_daily ?? '—'),
                'payouts' => ((int) $inv->roi_payouts_done).'/'.((int) $inv->duration_days ?: '?'),
                'next_roi_at' => $inv->next_roi_at?->toDateTimeString() ?? 'null',
                'due' => $dueNow && ! $blocked ? 'yes' : 'no',
                'blocked' => $blocked ? 'yes' : 'no',
            ];
        }

        $this->table(
            ['ID', 'User', 'Amount', 'Daily%', 'Paid/Term', 'next_roi_at', 'Due?', 'Blocked'],
            $tableRows,
        );

        if ($waiting > 0) {
            $this->newLine();
            $this->comment('New investments: first ROI runs when next_roi_at <= now (set at invest time).');
            $this->comment('To test now: in admin set next_roi_at to a past date, then run php artisan income:pay-roi');
        }

        if ($due > 0) {
            $this->newLine();
            $this->info("Run: php artisan income:pay-roi  (will process {$due} due investment(s))");
        }

        return self::SUCCESS;
    }
}
