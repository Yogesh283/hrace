<?php

namespace App\Console\Commands;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\R10LeadershipService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class IncomeDiagnoseR10LeadershipCommand extends Command
{
    protected $signature = 'income:diagnose-r10-leadership
                            {--period= : Calendar month YYYY-MM (defaults to previous month)}
                            {--limit=30 : Max users to scan for qualifiers}';

    protected $description = 'Show why R10 leadership did or did not pay (no tinker / shell_exec needed).';

    public function handle(R10LeadershipService $svc): int
    {
        $period = $this->option('period');
        if (! is_string($period) || $period === '') {
            $period = Carbon::now()->subMonth()->format('Y-m');
        }
        if (! preg_match('/^\d{4}-\d{2}$/', $period)) {
            $this->error('Invalid --period; use YYYY-MM.');

            return self::FAILURE;
        }

        $referenceId = (int) str_replace('-', '', $period);
        $limit = max(1, min(500, (int) $this->option('limit')));

        $this->info("R10 leadership diagnose — period {$period} (reference_id {$referenceId})");
        $this->newLine();

        $usersTotal = User::query()->count();
        $usersActive = User::query()->where('is_blocked', false)->count();
        $investmentsActive = Investment::query()->where('status', Investment::STATUS_ACTIVE)->count();
        $alreadyPaid = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP)
            ->where('reference_type', 'r10_leadership_month')
            ->where('reference_id', $referenceId)
            ->count();

        $this->table(
            ['Metric', 'Count'],
            [
                ['Users (all)', (string) $usersTotal],
                ['Users (not blocked)', (string) $usersActive],
                ['Active investments', (string) $investmentsActive],
                ["Ledger rows already paid for {$period}", (string) $alreadyPaid],
            ],
        );

        $this->newLine();
        $this->line('Scanning up to '.$limit.' non-blocked users for qualification…');

        $qualified = [];
        $lapsed = [];
        $scanned = 0;

        User::query()
            ->where('is_blocked', false)
            ->orderBy('id')
            ->limit($limit)
            ->each(function (User $user) use ($svc, &$qualified, &$lapsed, &$scanned): void {
                $scanned++;
                $self = $svc->selfActiveHoldUsd($user->id);
                $eligibility = $svc->evaluatePayoutEligibility($user->id, $self);

                if ($eligibility['eligible'] && $eligibility['rank'] !== null) {
                    $rank = $eligibility['rank'];
                    $level = (int) ($rank['level'] ?? 0);
                    $team = $svc->networkLevelTeamVolumeUsd($user->id, $level);
                    $pay = $svc->estimatedMonthlyPayUsd($team, $rank);

                    $qualified[] = [
                        'user_id' => (string) $user->id,
                        'rank' => (string) ($rank['code'] ?? ''),
                        'self_hold' => $self,
                        'level_team' => $team,
                        'est_pay' => $pay,
                    ];

                    return;
                }

                if ($eligibility['self_hold_lapsed']) {
                    $lapsed[] = [
                        'user_id' => (string) $user->id,
                        'would_be' => (string) ($eligibility['would_be_rank_code'] ?? ''),
                        'self_hold' => $self,
                    ];
                }
            });

        $this->newLine();
        $this->info("Scanned: {$scanned} user(s)");

        if ($qualified === []) {
            $this->warn('No qualifying members in this scan (self hold + level team volume for a rank).');
            $this->line('R1 needs: self hold ≥ $100 AND level-1 team volume ≥ $10,000.');
        } else {
            $this->info('Would qualify for payout ('.count($qualified).'):');
            $this->table(
                ['User ID', 'Rank', 'Self hold', 'Level team vol.', 'Est. pay'],
                $qualified,
            );
        }

        if ($lapsed !== []) {
            $this->newLine();
            $this->warn('Self-hold lapse (team OK, self hold short) — '.count($lapsed).':');
            $this->table(['User ID', 'Would-be rank', 'Self hold'], $lapsed);
        }

        if ($qualified !== [] && $alreadyPaid > 0) {
            $this->newLine();
            $this->comment('Some users may already have a ledger row for this period — pay command skips duplicates.');
        }

        if ($qualified !== [] && $alreadyPaid === 0) {
            $this->newLine();
            $this->comment('Run payout: php artisan income:pay-r10-leadership --period='.$period);
        }

        return self::SUCCESS;
    }
}
