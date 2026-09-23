<?php

namespace App\Console\Commands;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\LedgerWriter;
use App\Services\Income\R10LeadershipService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IncomePayR10LeadershipCommand extends Command
{
    protected $signature = 'income:pay-r10-leadership {--period= : Calendar month YYYY-MM (defaults to previous month)}';

    protected $description = 'Pay Affiliate R10 Leadership monthly rewards (rank % × downline team volume).';

    public function handle(LedgerWriter $ledger, R10LeadershipService $svc): int
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

        $paid = 0;
        User::query()
            ->where('is_blocked', false)
            ->orderBy('id')
            ->chunkById(150, function ($users) use ($ledger, $svc, $period, $referenceId, &$paid): void {
                foreach ($users as $user) {
                    DB::transaction(function () use ($ledger, $svc, $user, $period, $referenceId, &$paid): void {
                        $self = $svc->selfActiveHoldUsd($user->id);
                        $ranks = $svc->qualifyingRankRows($user->id, $self);
                        if ($ranks === []) {
                            return;
                        }

                        foreach ($ranks as $rank) {
                            $rankCode = (string) ($rank['code'] ?? '');

                            $exists = LedgerEntry::query()
                                ->where('user_id', $user->id)
                                ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP)
                                ->where('reference_type', 'r10_leadership_month')
                                ->where('reference_id', $referenceId)
                                ->where('meta->rank_code', $rankCode)
                                ->lockForUpdate()
                                ->exists();
                            if ($exists) {
                                continue;
                            }

                            $level = (int) ($rank['level'] ?? 0);
                            $team = $svc->networkLevelTeamVolumeUsd($user->id, $level);
                            $pct = (float) ($rank['team_volume_percent'] ?? $rank['month_reward_percent'] ?? 0);
                            if ($pct <= 0 || $level < 1) {
                                continue;
                            }

                            $billable = $svc->billableTeamVolumeUsd($team, $rank);
                            $rate = bcdiv(number_format($pct, 4, '.', ''), '100', 8);
                            $pay = bcmul($billable, $rate, 2);
                            if (bccomp($pay, '0', 2) <= 0) {
                                continue;
                            }

                            $ledger->record(
                                $user,
                                LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP,
                                $pay,
                                'r10_leadership_month',
                                $referenceId,
                                [
                                    'period' => $period,
                                    'rank_code' => $rankCode,
                                    'level' => $level,
                                    'team_volume_percent' => $pct,
                                    'month_reward_percent' => $pct,
                                    'base_team_volume_usd' => $team,
                                    'billable_team_volume_usd' => $billable,
                                    'required_team_volume_usd' => number_format((float) ($rank['team_volume_usd'] ?? 0), 2, '.', ''),
                                    'self_hold_usd' => $self,
                                ],
                            );
                            $paid++;
                        }
                    });
                }
            });

        $this->info("R10 leadership payouts for {$period}: {$paid} payment(s).");

        return self::SUCCESS;
    }
}
