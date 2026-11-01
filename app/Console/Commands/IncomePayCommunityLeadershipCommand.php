<?php

namespace App\Console\Commands;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\CommunityLeadershipService;
use App\Services\Income\LedgerWriter;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IncomePayCommunityLeadershipCommand extends Command
{
    protected $signature = 'income:pay-community-leadership
                            {--period= : Calendar day YYYY-MM-DD (defaults to today)}
                            {--force : TESTING — delete this period\'s leadership ledger rows first, then pay again}';

    protected $description = 'Pay Community Leadership rewards (24-hour cycle per PDF).';

    public function handle(LedgerWriter $ledger, CommunityLeadershipService $svc): int
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        $period = $this->option('period');
        if (! is_string($period) || $period === '') {
            $period = Carbon::now()->format('Y-m-d');
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $period)) {
            $this->error('Invalid --period; use YYYY-MM-DD.');

            return self::FAILURE;
        }

        $referenceId = (int) str_replace('-', '', $period);

        if ($this->option('force')) {
            $this->call('income:purge-cron-day', [
                '--date' => $period,
                '--types' => 'leadership',
                '--yes' => true,
            ]);
        }

        $context = $svc->buildPayoutContext();
        $payouts = $svc->calculateAllDailyPayouts($context);
        $paid = 0;

        // Snapshot rank holds for Rank 11 monthly bonus (full-month $10,000,000 check).
        foreach ($context['qual_rank'] as $userId => $rank) {
            if ($rank === null) {
                continue;
            }
            $user = User::query()->find($userId);
            if ($user) {
                $svc->recordDailyHold($user, $period);
            }
        }

        foreach ($payouts as $userId => $payload) {
            /** @var User $user */
            $user = $payload['user'];
            $rank = $payload['rank'];
            $payout = $payload['payout'];
            $level = (int) ($rank['level'] ?? 0);

            DB::transaction(function () use ($ledger, $svc, $user, $userId, $period, $referenceId, $rank, $payout, $level, &$paid): void {
                $exists = LedgerEntry::query()
                    ->where('user_id', $userId)
                    ->whereIn('entry_type', [
                        LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
                        LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
                    ])
                    ->where('reference_type', 'community_leadership_day')
                    ->where('reference_id', $referenceId)
                    ->where('meta->level', $level)
                    ->lockForUpdate()
                    ->exists();

                if ($exists) {
                    return;
                }

                $pct = (float) ($rank['reward_percent'] ?? 0);
                $self = $svc->selfActiveHoldUsd($userId);
                $baseMeta = [
                    'period' => $period,
                    'level' => $level,
                    'reward_percent' => $pct,
                    'team_volume_usd' => $svc->downlineTeamVolumeUsd($userId),
                    'team_daily_roi_usd' => $svc->downlineTeamDailyRoiUsd($userId),
                    'self_hold_usd' => $self,
                    'qualified_directs' => $svc->qualifiedDirectCount($userId),
                    'generation_gap_usd' => $payout['generation_gap_usd'],
                    'compression_usd' => $payout['compression_usd'],
                    'same_rank_usd' => $payout['same_rank_usd'],
                    'skip_level_usd' => $payout['skip_level_usd'] ?? '0.00',
                    'legs' => $payout['legs'],
                ];

                $gapAndCompression = bcadd($payout['generation_gap_usd'], $payout['compression_usd'], 2);
                if (bccomp($gapAndCompression, '0', 2) > 0) {
                    $ledger->record(
                        $user,
                        LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
                        $gapAndCompression,
                        'community_leadership_day',
                        $referenceId,
                        $baseMeta,
                    );
                    $paid++;
                }

                if (bccomp($payout['same_rank_usd'], '0', 2) > 0) {
                    $ledger->record(
                        $user,
                        LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
                        $payout['same_rank_usd'],
                        'community_leadership_day',
                        $referenceId,
                        array_merge($baseMeta, [
                            'allocation' => 'same_rank',
                            'same_rank_percent' => \App\Support\RewardPlan::communityLeadershipSameRankPercent(),
                        ]),
                    );
                    $paid++;
                }

                $skipUsd = $payout['skip_level_usd'] ?? '0.00';
                if (bccomp($skipUsd, '0', 2) > 0) {
                    $ledger->record(
                        $user,
                        LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
                        $skipUsd,
                        'community_leadership_day',
                        $referenceId,
                        array_merge($baseMeta, [
                            'allocation' => 'skip_level',
                            'skip_level_percent' => \App\Support\RewardPlan::communityLeadershipSkipLevelPercent(),
                        ]),
                    );
                    $paid++;
                }
            });
        }

        $this->info("Community Leadership payouts for {$period}: {$paid} payment(s).");

        return self::SUCCESS;
    }
}
