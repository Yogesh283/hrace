<?php

namespace App\Console\Commands;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\CommunityLeadershipService;
use App\Services\Income\LedgerWriter;
use App\Support\RewardPlan;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IncomePayCommunityLeadershipRank11MonthlyCommand extends Command
{
    protected $signature = 'income:pay-community-leadership-rank11-monthly {--period= : Calendar month YYYY-MM (defaults to previous month)}';

    protected $description = 'Royalty Achievement: pay up to $5000/mo when you + one DIRECT Rank 11 both maintained $10M full month.';

    public function handle(LedgerWriter $ledger, CommunityLeadershipService $svc): int
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        if (! RewardPlan::communityLeadershipRank11MonthlyBonusEnabled()) {
            $this->info('Rank 11 monthly bonus is disabled.');

            return self::SUCCESS;
        }

        $period = $this->option('period');
        if (! is_string($period) || $period === '') {
            $period = Carbon::now()->subMonth()->format('Y-m');
        }
        if (! preg_match('/^\d{4}-\d{2}$/', $period)) {
            $this->error('Invalid --period; use YYYY-MM.');

            return self::FAILURE;
        }

        $referenceId = (int) str_replace('-', '', $period);
        $reward = number_format(RewardPlan::communityLeadershipRank11MonthlyRewardUsd(), 2, '.', '');
        $requiredRank = RewardPlan::communityLeadershipRank11RequiredRank();
        $paid = 0;

        User::query()
            ->where('is_blocked', false)
            ->whereNotNull('participation_activated_at')
            ->orderBy('id')
            ->chunkById(150, function ($users) use ($ledger, $svc, $period, $referenceId, $reward, $requiredRank, &$paid): void {
                foreach ($users as $user) {
                    DB::transaction(function () use ($ledger, $svc, $user, $period, $referenceId, $reward, $requiredRank, &$paid): void {
                        if (! $svc->qualifiesRank11MonthlyBonus($user->id, $period)) {
                            return;
                        }

                        $exists = LedgerEntry::query()
                            ->where('user_id', $user->id)
                            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY)
                            ->where('reference_type', 'community_leadership_rank11_month')
                            ->where('reference_id', $referenceId)
                            ->lockForUpdate()
                            ->exists();

                        if ($exists) {
                            return;
                        }

                        $self = $svc->selfActiveHoldUsd($user->id);
                        $team = $svc->downlineTeamVolumeUsd($user->id);

                        $ledger->record(
                            $user,
                            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY,
                            $reward,
                            'community_leadership_rank11_month',
                            $referenceId,
                            [
                                'period' => $period,
                                'rank' => $requiredRank,
                                'program' => 'royalty_achievement',
                                'reward_usd' => $reward,
                                'required_team_volume_usd' => RewardPlan::communityLeadershipRank11RequiredTeamVolumeUsd(),
                                'require_direct_rank_11' => RewardPlan::communityLeadershipRank11RequiresDirectTeamMember(),
                                'team_volume_usd' => $team,
                                'self_hold_usd' => $self,
                                'note' => 'Royalty Achievement: you + direct Rank 11 both maintained $10M (1 crore) full month',
                            ],
                        );
                        $paid++;
                    });
                }
            });

        $this->info("Royalty Achievement payouts for {$period}: {$paid} payment(s) of \${$reward}.");

        return self::SUCCESS;
    }
}
