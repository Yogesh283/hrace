<?php

namespace App\Services\Income;

use App\Models\CommunityLeadershipDailyHold;
use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\RewardPlan;
use Carbon\Carbon;

class CommunityLeadershipService
{
    public function __construct(
        protected ReferralTree $tree,
    ) {}

    public function selfActiveHoldUsd(int $userId): string
    {
        $qualifyingMin = number_format(RewardPlan::participationQualifyingMinUsd(), 2, '.', '');

        $sum = Investment::query()
            ->where('user_id', $userId)
            ->where('status', Investment::STATUS_ACTIVE)
            ->where('amount_usd', '>=', $qualifyingMin)
            ->sum('amount_usd');

        return number_format((float) $sum, 2, '.', '');
    }

    public function downlineTeamVolumeUsd(int $userId): string
    {
        // Generation / leadership: full referral tree, no fixed level cap.
        return $this->tree->downlineInvestmentVolumeUsd($userId, true);
    }

    /**
     * Sum of daily ROI (USD) from all active downline participation stakes (unlimited depth).
     */
    public function downlineTeamDailyRoiUsd(int $userId): string
    {
        $ids = $this->tree->allReferralDescendantIds($userId);
        if ($ids === []) {
            return '0.00';
        }

        return $this->sumDailyRoiForUserIds($ids);
    }

    public function qualifiedDirectCount(int $userId): int
    {
        return $this->tree->participationDirectCount($userId);
    }

    public function leadershipActivated(int $userId): bool
    {
        return $this->qualifiedDirectCount($userId) >= RewardPlan::communityLeadershipMinDirects();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function qualifyingRankRow(int $userId, ?string $selfHoldUsd = null): ?array
    {
        if (! $this->leadershipActivated($userId)) {
            return null;
        }

        $selfHoldUsd ??= $this->selfActiveHoldUsd($userId);
        $team = $this->downlineTeamVolumeUsd($userId);
        $directs = $this->qualifiedDirectCount($userId);
        $current = null;

        foreach (RewardPlan::communityLeadershipRanks() as $row) {
            $needSelf = number_format((float) ($row['self_hold_usd'] ?? 0), 2, '.', '');
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            $needDirect = (int) ($row['direct_required'] ?? 0);

            if (
                bccomp($selfHoldUsd, $needSelf, 2) >= 0
                && bccomp($team, $needTeam, 2) >= 0
                && $directs >= $needDirect
            ) {
                $current = $row;
            }
        }

        return $current;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function qualifyingRankRows(int $userId, string $selfHoldUsd): array
    {
        if (! $this->leadershipActivated($userId)) {
            return [];
        }

        $team = $this->downlineTeamVolumeUsd($userId);
        $directs = $this->qualifiedDirectCount($userId);
        $out = [];

        foreach (RewardPlan::communityLeadershipRanks() as $row) {
            $needSelf = number_format((float) ($row['self_hold_usd'] ?? 0), 2, '.', '');
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            $needDirect = (int) ($row['direct_required'] ?? 0);

            if (
                bccomp($selfHoldUsd, $needSelf, 2) >= 0
                && bccomp($team, $needTeam, 2) >= 0
                && $directs >= $needDirect
            ) {
                $out[] = $row;
            }
        }

        return $out;
    }

    public function estimatedDailyPayUsd(string $teamDailyRoiUsd, ?array $rankRow): string
    {
        if ($rankRow === null) {
            return '0.00';
        }

        $pct = (float) ($rankRow['reward_percent'] ?? 0);
        if ($pct <= 0 || bccomp($teamDailyRoiUsd, '0', 2) <= 0) {
            return '0.00';
        }

        return $this->amountFromPercent($teamDailyRoiUsd, $pct);
    }

    /**
     * Daily leadership payout using per-leg generation gap, compression, and same-rank rules.
     *
     * @return array{
     *     total: string,
     *     generation_gap_usd: string,
     *     compression_usd: string,
     *     same_rank_usd: string,
     *     legs: list<array<string, mixed>>
     * }
     */
    public function calculateLeaderDailyPayout(int $leaderId, ?array $context = null): array
    {
        $context ??= $this->buildPayoutContext();
        $rank = $context['qual_rank'][$leaderId] ?? null;

        if ($rank === null) {
            return $this->emptyPayout();
        }

        $leaderPct = (float) ($rank['reward_percent'] ?? 0);
        if ($leaderPct <= 0) {
            return $this->emptyPayout();
        }

        $leaderLevel = (int) ($rank['level'] ?? 0);
        $rank11 = RewardPlan::communityLeadershipRank11RequiredRank();

        // Rank 11 + direct Rank 11 → daily Rank 11 income stops; Royalty Achievement path.
        if (
            $leaderLevel >= $rank11
            && RewardPlan::communityLeadershipRank11StopDailyWhenTeamHasRank11()
            && $this->hasQualifiedRank11Partner($leaderId, $context)
        ) {
            return array_merge($this->emptyPayout(), [
                'blocked_reason' => 'rank_11_direct_royalty',
            ]);
        }

        $total = '0.00';
        $generationGapUsd = '0.00';
        $compressionUsd = '0.00';
        $sameRankUsd = '0.00';
        $skipLevelUsd = '0.00';
        $legs = [];

        foreach ($context['children'][$leaderId] ?? [] as $legRootId) {
            $legRoi = $context['subtree_daily_roi'][$legRootId] ?? '0.00';
            if (bccomp($legRoi, '0', 2) <= 0) {
                continue;
            }

            $highest = $context['highest_qualified_in_subtree'][$legRootId] ?? null;
            $legAmount = '0.00';
            $allocation = 'none';

            if ($highest === null) {
                $legAmount = $this->amountFromPercent($legRoi, $leaderPct);
                $allocation = 'compression';
                $compressionUsd = bcadd($compressionUsd, $legAmount, 2);
            } else {
                $highestPct = (float) ($highest['reward_percent'] ?? 0);
                $gap = $leaderPct - $highestPct;

                if ($gap > 0) {
                    $legAmount = $this->amountFromPercent($legRoi, $gap);
                    $allocation = 'generation_gap';
                    $generationGapUsd = bcadd($generationGapUsd, $legAmount, 2);
                } elseif ($gap === 0.0) {
                    $blockFrom = RewardPlan::communityLeadershipSameRankBlockFromRank();
                    $allowUpTo = RewardPlan::communityLeadershipSameRankAllowPercentUpToRank();

                    // Rank 2–11: same-rank in team → $0 on this leg until you qualify next rank.
                    if ($leaderLevel >= $blockFrom) {
                        $allocation = 'same_rank_blocked';
                        $legs[] = [
                            'leg_root_user_id' => $legRootId,
                            'leg_daily_roi_usd' => $legRoi,
                            'allocation' => $allocation,
                            'amount_usd' => '0.00',
                            'highest_qualified_user_id' => $highest['user_id'] ?? null,
                            'highest_qualified_level' => $highest['level'] ?? null,
                            'highest_qualified_percent' => isset($highest['reward_percent']) ? (float) $highest['reward_percent'] : null,
                        ];
                        continue;
                    }

                    // Rank 1: 1 same-rank → 5% same_rank; 2+ same-rank → skip-level %.
                    if ($leaderLevel >= 1 && $leaderLevel <= $allowUpTo) {
                        $sameRankCount = $this->countSameRankQualifiedInLegSubtree(
                            $legRootId,
                            $leaderPct,
                            $context,
                        );
                        $maxSameRank = RewardPlan::communityLeadershipSameRankMaxPerLineage();

                        if ($sameRankCount >= 1 && $sameRankCount <= $maxSameRank) {
                            $sameRankPct = RewardPlan::communityLeadershipSameRankPercent();
                            $legAmount = $this->amountFromPercent($legRoi, $sameRankPct);
                            $allocation = 'same_rank';
                            $sameRankUsd = bcadd($sameRankUsd, $legAmount, 2);
                        } elseif ($sameRankCount > $maxSameRank) {
                            $skipPct = RewardPlan::communityLeadershipSkipLevelPercent();
                            $legAmount = $this->amountFromPercent($legRoi, $skipPct);
                            $allocation = 'skip_level';
                            $skipLevelUsd = bcadd($skipLevelUsd, $legAmount, 2);
                        }
                    }
                }
            }

            if (bccomp($legAmount, '0', 2) > 0) {
                $total = bcadd($total, $legAmount, 2);
                $legs[] = [
                    'leg_root_user_id' => $legRootId,
                    'leg_daily_roi_usd' => $legRoi,
                    'allocation' => $allocation,
                    'amount_usd' => $legAmount,
                    'highest_qualified_user_id' => $highest['user_id'] ?? null,
                    'highest_qualified_level' => $highest['level'] ?? null,
                    'highest_qualified_percent' => isset($highest['reward_percent']) ? (float) $highest['reward_percent'] : null,
                ];
            }
        }

        return [
            'total' => $total,
            'generation_gap_usd' => $generationGapUsd,
            'compression_usd' => $compressionUsd,
            'same_rank_usd' => $sameRankUsd,
            'skip_level_usd' => $skipLevelUsd,
            'legs' => $legs,
        ];
    }

    /**
     * @return array{
     *     qual_rank: array<int, array<string, mixed>|null>,
     *     children: array<int, list<int>>,
     *     subtree_daily_roi: array<int, string>,
     *     highest_qualified_in_subtree: array<int, array<string, mixed>|null>
     * }
     */
    public function buildPayoutContext(): array
    {
        $users = User::query()
            ->where('is_blocked', false)
            ->get(['id', 'referred_by']);

        $children = [];
        $qualRank = [];
        $ownDailyRoi = [];

        foreach ($users as $user) {
            $userId = (int) $user->id;
            $qualRank[$userId] = $this->qualifyingRankRow($userId);
            $ownDailyRoi[$userId] = $this->dailyRoiUsdForUser($userId);

            if ($user->referred_by) {
                $children[(int) $user->referred_by][] = $userId;
            }
        }

        $subtreeDailyRoi = [];
        $highestQualifiedInSubtree = [];
        $visited = [];

        $computeSubtree = function (int $userId) use (
            &$computeSubtree,
            &$visited,
            $children,
            $ownDailyRoi,
            $qualRank,
            &$subtreeDailyRoi,
            &$highestQualifiedInSubtree,
        ): void {
            if (isset($visited[$userId])) {
                return;
            }

            $visited[$userId] = true;
            $subtreeTotal = $ownDailyRoi[$userId] ?? '0.00';
            $best = $this->rankWithUserId($userId, $qualRank[$userId] ?? null);

            foreach ($children[$userId] ?? [] as $childId) {
                $computeSubtree($childId);
                $subtreeTotal = bcadd($subtreeTotal, $subtreeDailyRoi[$childId] ?? '0.00', 8);
                $childBest = $highestQualifiedInSubtree[$childId] ?? null;

                if ($childBest !== null && ($best === null || (float) $childBest['reward_percent'] > (float) $best['reward_percent'])) {
                    $best = $childBest;
                }
            }

            $subtreeDailyRoi[$userId] = number_format((float) $subtreeTotal, 2, '.', '');
            $highestQualifiedInSubtree[$userId] = $best;
        };

        foreach (array_keys($qualRank) as $userId) {
            $computeSubtree((int) $userId);
        }

        return [
            'qual_rank' => $qualRank,
            'children' => $children,
            'subtree_daily_roi' => $subtreeDailyRoi,
            'highest_qualified_in_subtree' => $highestQualifiedInSubtree,
        ];
    }

    /**
     * @return array<int, array{
     *     user: User,
     *     rank: array<string, mixed>,
     *     payout: array<string, mixed>
     * }>
     */
    public function calculateAllDailyPayouts(?array $context = null): array
    {
        $context ??= $this->buildPayoutContext();
        $userIds = array_keys(array_filter(
            $context['qual_rank'],
            static fn (?array $rank): bool => $rank !== null,
        ));

        if ($userIds === []) {
            return [];
        }

        $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');
        $payouts = [];

        foreach ($userIds as $userId) {
            $payout = $this->calculateLeaderDailyPayout((int) $userId, $context);
            if (bccomp($payout['total'], '0', 2) <= 0) {
                continue;
            }

            $user = $users->get($userId);
            if (! $user) {
                continue;
            }

            $payouts[(int) $userId] = [
                'user' => $user,
                'rank' => $context['qual_rank'][$userId],
                'payout' => $payout,
            ];
        }

        return $payouts;
    }

    /**
     * @return array<string, mixed>
     */
    public function pagePropsFor(User $user): array
    {
        $self = $this->selfActiveHoldUsd($user->id);
        $team = $this->downlineTeamVolumeUsd($user->id);
        $teamDailyRoi = $this->downlineTeamDailyRoiUsd($user->id);
        $directs = $this->qualifiedDirectCount($user->id);
        $current = $this->qualifyingRankRow($user->id, $self);
        $ranks = RewardPlan::communityLeadershipRanks();
        $payoutContext = $this->buildPayoutContext();
        $estimatedPayout = $this->calculateLeaderDailyPayout($user->id, $payoutContext);
        $rank11 = RewardPlan::communityLeadershipRank11RequiredRank();
        $isRank11 = $current !== null && (int) ($current['level'] ?? 0) >= $rank11;
        $hasTeamRank11 = $isRank11 && $this->hasQualifiedRank11Partner($user->id, $payoutContext);
        $dailyBlockedByTeamRank11 = $hasTeamRank11
            && RewardPlan::communityLeadershipRank11StopDailyWhenTeamHasRank11();

        $ladder = [];
        foreach ($ranks as $row) {
            $needSelf = (float) ($row['self_hold_usd'] ?? 0);
            $needTeam = (float) ($row['team_volume_usd'] ?? 0);
            $needDirect = (int) ($row['direct_required'] ?? 0);
            $selfMet = bccomp($self, number_format($needSelf, 2, '.', ''), 2) >= 0;
            $teamMet = bccomp($team, number_format($needTeam, 2, '.', ''), 2) >= 0;
            $directMet = $directs >= $needDirect;
            $qualified = $selfMet && $teamMet && $directMet && $this->leadershipActivated($user->id);

            $ladder[] = [
                'level' => (int) ($row['level'] ?? 0),
                'required_self_hold_usd' => $needSelf,
                'required_team_volume_usd' => $needTeam,
                'required_directs' => $needDirect,
                'reward_percent' => (float) ($row['reward_percent'] ?? 0),
                'live_self_hold_usd' => (float) $self,
                'live_team_volume_usd' => (float) $team,
                'live_team_daily_roi_usd' => (float) $teamDailyRoi,
                'live_directs' => $directs,
                'qualified' => $qualified,
                'estimated_daily_pay_usd' => (float) ($qualified && $current && (int) ($row['level'] ?? 0) === (int) ($current['level'] ?? 0)
                    ? $estimatedPayout['total']
                    : '0.00'),
                'is_current' => $current && (int) ($row['level'] ?? 0) === (int) ($current['level'] ?? 0),
            ];
        }

        $last = LedgerEntry::query()
            ->production()
            ->where('user_id', $user->id)
            ->whereIn('entry_type', [
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
            ])
            ->latest('id')
            ->first(['amount_usd', 'created_at', 'meta']);

        return [
            'program_name' => 'Community Leadership',
            'self_hold_usd' => $self,
            'team_volume_usd' => $team,
            'team_daily_roi_usd' => $teamDailyRoi,
            'qualified_directs' => $directs,
            'leadership_activated' => $this->leadershipActivated($user->id),
            'min_directs_required' => RewardPlan::communityLeadershipMinDirects(),
            'distribution_cycle_hours' => RewardPlan::communityLeadershipCycleHours(),
            'current_rank' => $current,
            'estimated_daily_pay_usd' => (float) $estimatedPayout['total'],
            'estimated_generation_gap_usd' => (float) $estimatedPayout['generation_gap_usd'],
            'estimated_compression_usd' => (float) $estimatedPayout['compression_usd'],
            'estimated_same_rank_usd' => (float) $estimatedPayout['same_rank_usd'],
            'estimated_skip_level_usd' => (float) ($estimatedPayout['skip_level_usd'] ?? 0),
            'ladder' => $ladder,
            'rank_11_monthly_bonus' => [
                'enabled' => RewardPlan::communityLeadershipRank11MonthlyBonusEnabled(),
                'required_rank' => RewardPlan::communityLeadershipRank11RequiredRank(),
                'required_team_volume_usd' => RewardPlan::communityLeadershipRank11RequiredTeamVolumeUsd(),
                'reward_usd' => RewardPlan::communityLeadershipRank11MonthlyRewardUsd(),
                'require_team_member_rank_11' => RewardPlan::communityLeadershipRank11RequiresTeamMember(),
                'require_direct_team_member_rank_11' => RewardPlan::communityLeadershipRank11RequiresDirectTeamMember(),
                'stop_daily_when_team_has_rank_11' => RewardPlan::communityLeadershipRank11StopDailyWhenTeamHasRank11(),
                'is_rank_11' => $isRank11,
                'has_team_rank_11' => $hasTeamRank11,
                'daily_blocked_by_team_rank_11' => $dailyBlockedByTeamRank11,
            ],
            'last_payout' => $last ? [
                'amount_usd' => number_format((float) $last->amount_usd, 2, '.', ''),
                'at' => $last->created_at?->toIso8601String(),
                'period' => is_array($last->meta) ? ($last->meta['period'] ?? null) : null,
            ] : null,
            'payout_note' => 'Leadership = team daily ROI × rank % (ROI of ROI). '
                .'Min '.RewardPlan::communityLeadershipMinDirects().' qualified directs. '
                .'24-hour distribution cycle (income:pay-community-leadership). '
                .'Generation gap when downline ranks are lower. '
                .'Same-rank (1 in lineage): '.RewardPlan::communityLeadershipSameRankPercent().'%. '
                .'Skip-level (2+ same rank in lineage): '.RewardPlan::communityLeadershipSkipLevelPercent().'%. '
                .'Rank 2–11 same-rank leg: $0 until you upgrade. '
                .'Solo Rank 11: keep daily 110%. '
                .'Royalty Achievement: you Rank 11 + one DIRECT Rank 11 → daily Rank 11 stops; '
                .'both maintain $10M (1 crore) full month → up to $'
                .number_format(RewardPlan::communityLeadershipRank11MonthlyRewardUsd(), 0)
                .'/month.',
        ];
    }

    /**
     * Flattened live ledger for /leadership/live-data (not nested under `live`).
     *
     * @return array<string, mixed>
     */
    public function liveDataPagePropsFor(User $user): array
    {
        $p = $this->pagePropsFor($user);
        $ladder = is_array($p['ladder'] ?? null) ? $p['ladder'] : [];

        $rows = [];
        foreach ($ladder as $row) {
            $needSelf = (float) ($row['required_self_hold_usd'] ?? 0);
            $needTeam = (float) ($row['required_team_volume_usd'] ?? 0);
            $liveSelf = (float) ($row['live_self_hold_usd'] ?? $p['self_hold_usd'] ?? 0);
            $liveTeam = (float) ($row['live_team_volume_usd'] ?? $p['team_volume_usd'] ?? 0);
            $needDirects = (int) ($row['required_directs'] ?? 0);
            $liveDirects = (int) ($row['live_directs'] ?? $p['qualified_directs'] ?? 0);
            $level = (int) ($row['level'] ?? 0);

            $rows[] = [
                'rank_code' => 'L'.$level,
                'network_level' => $level,
                'required_self_hold_usd' => $needSelf,
                'live_self_hold_usd' => $liveSelf,
                'required_team_volume_usd' => $needTeam,
                'live_team_volume_usd' => $liveTeam,
                'required_directs' => $needDirects,
                'live_directs' => $liveDirects,
                'team_volume_percent' => (float) ($row['reward_percent'] ?? 0),
                'estimated_earned_usd' => (float) ($row['estimated_daily_pay_usd'] ?? 0),
                'self_hold_met' => $liveSelf >= $needSelf,
                'team_volume_met' => $liveTeam >= $needTeam,
                'directs_met' => $liveDirects >= $needDirects,
                'qualified' => (bool) ($row['qualified'] ?? false),
                'is_current' => (bool) ($row['is_current'] ?? false),
            ];
        }

        return [
            'program_name' => (string) ($p['program_name'] ?? 'Community Leadership'),
            'live_self_hold_usd' => $p['self_hold_usd'] ?? '0.00',
            'team_volume_usd' => $p['team_volume_usd'] ?? '0.00',
            'team_daily_roi_usd' => $p['team_daily_roi_usd'] ?? '0.00',
            'qualified_directs' => (int) ($p['qualified_directs'] ?? 0),
            'rows' => $rows,
            'closing' => [
                'current_period' => $this->currentPeriodKey(),
                'payout_period' => is_array($p['last_payout'] ?? null) ? ($p['last_payout']['period'] ?? null) : null,
                'closing_note' => (string) ($p['payout_note'] ?? ''),
                'self_hold_lapsed' => false,
                'lapse_message' => null,
            ],
        ];
    }

    public function currentPeriodKey(): string
    {
        return Carbon::now()->format('Y-m-d');
    }

    /**
     * Snapshot today's rank hold for Rank 11 monthly bonus eligibility.
     */
    public function recordDailyHold(User $user, string $holdDate): void
    {
        $date = Carbon::parse($holdDate)->toDateString();
        $self = $this->selfActiveHoldUsd($user->id);
        $rank = $this->qualifyingRankRow($user->id, $self);
        $level = (int) ($rank['level'] ?? 0);
        if ($level < 1) {
            return;
        }

        $payload = [
            'rank_level' => $level,
            'team_volume_usd' => $this->downlineTeamVolumeUsd($user->id),
            'self_hold_usd' => $self,
            'qualified_directs' => $this->qualifiedDirectCount($user->id),
        ];

        $existing = CommunityLeadershipDailyHold::query()
            ->where('user_id', $user->id)
            ->whereDate('hold_date', $date)
            ->first();

        if ($existing) {
            $existing->forceFill($payload)->save();

            return;
        }

        CommunityLeadershipDailyHold::query()->create(array_merge($payload, [
            'user_id' => $user->id,
            'hold_date' => $date,
        ]));
    }

    /**
     * True when user held Rank 11 with >= 1 crore team volume on every day of the calendar month.
     */
    public function heldRank11FullMonth(int $userId, string $periodYm): bool
    {
        $requiredRank = RewardPlan::communityLeadershipRank11RequiredRank();
        $requiredVolume = number_format(RewardPlan::communityLeadershipRank11RequiredTeamVolumeUsd(), 2, '.', '');

        $start = Carbon::createFromFormat('!Y-m', $periodYm)->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $daysInMonth = $start->daysInMonth;

        $holds = CommunityLeadershipDailyHold::query()
            ->where('user_id', $userId)
            ->whereDate('hold_date', '>=', $start->toDateString())
            ->whereDate('hold_date', '<=', $end->toDateString())
            ->where('rank_level', '>=', $requiredRank)
            ->where('team_volume_usd', '>=', $requiredVolume)
            ->count();

        return $holds >= $daysInMonth;
    }

    /**
     * True when at least one DIRECT (or any downline if config allows) held Rank 11 / $10M full month.
     */
    public function hasTeamMemberHeldRank11FullMonth(int $leaderId, string $periodYm): bool
    {
        $memberIds = RewardPlan::communityLeadershipRank11RequiresDirectTeamMember()
            ? $this->directReferralIds($leaderId)
            : $this->tree->allReferralDescendantIds($leaderId);

        if ($memberIds === []) {
            return false;
        }

        foreach ($memberIds as $memberId) {
            if ($this->heldRank11FullMonth((int) $memberId, $periodYm)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Royalty Achievement monthly $5,000: you + at least one DIRECT Rank 11 both maintained $10M full month.
     * (Daily Rank 11 income already stopped once a qualifying Rank 11 direct exists.)
     */
    public function qualifiesRank11MonthlyBonus(int $userId, string $periodYm): bool
    {
        if (! $this->heldRank11FullMonth($userId, $periodYm)) {
            return false;
        }

        if (! RewardPlan::communityLeadershipRank11RequiresTeamMember()) {
            return true;
        }

        return $this->hasTeamMemberHeldRank11FullMonth($userId, $periodYm);
    }

    /**
     * Currently has a qualifying Rank 11 partner (direct by default).
     *
     * @param  array{
     *     qual_rank?: array<int, array<string, mixed>|null>,
     *     children?: array<int, list<int>>,
     *     highest_qualified_in_subtree?: array<int, array<string, mixed>|null>
     * }|null  $context
     */
    public function hasQualifiedRank11Partner(int $leaderId, ?array $context = null): bool
    {
        $rank11 = RewardPlan::communityLeadershipRank11RequiredRank();
        $context ??= $this->buildPayoutContext();

        if (RewardPlan::communityLeadershipRank11RequiresDirectTeamMember()) {
            foreach ($context['children'][$leaderId] ?? [] as $directId) {
                $rank = $context['qual_rank'][$directId] ?? null;
                if ($rank !== null && (int) ($rank['level'] ?? 0) >= $rank11) {
                    return true;
                }
            }

            return false;
        }

        return $this->hasDownlineQualifiedRank($leaderId, $rank11, $context);
    }

    /**
     * @return list<int>
     */
    public function directReferralIds(int $leaderId): array
    {
        return User::query()
            ->where('referred_by', $leaderId)
            ->where('is_blocked', false)
            ->pluck('id')
            ->map(static fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * True when any downline currently qualifies at/above the given rank level.
     *
     * @param  array{
     *     children: array<int, list<int>>,
     *     highest_qualified_in_subtree: array<int, array<string, mixed>|null>
     * }  $context
     */
    public function hasDownlineQualifiedRank(int $leaderId, int $minLevel, ?array $context = null): bool
    {
        $context ??= $this->buildPayoutContext();

        foreach ($context['children'][$leaderId] ?? [] as $legRootId) {
            $highest = $context['highest_qualified_in_subtree'][$legRootId] ?? null;
            if ($highest !== null && (int) ($highest['level'] ?? 0) >= $minLevel) {
                return true;
            }
        }

        return false;
    }

    public function dailyRoiUsdForUser(int $userId): string
    {
        $investments = Investment::query()
            ->where('user_id', $userId)
            ->where('status', Investment::STATUS_ACTIVE)
            ->get(['amount_usd', 'roi_percent_daily']);

        $total = '0.00';
        foreach ($investments as $investment) {
            $dailyPct = (string) ($investment->roi_percent_daily ?? '0');
            if (bccomp($dailyPct, '0', 4) <= 0) {
                continue;
            }

            $total = bcadd(
                $total,
                bcmul(
                    (string) $investment->amount_usd,
                    bcdiv($dailyPct, '100', 8),
                    8,
                ),
                8,
            );
        }

        return number_format((float) $total, 2, '.', '');
    }

    /**
     * @param  list<int>  $userIds
     */
    protected function sumDailyRoiForUserIds(array $userIds): string
    {
        if ($userIds === []) {
            return '0.00';
        }

        $investments = Investment::query()
            ->whereIn('user_id', $userIds)
            ->where('status', Investment::STATUS_ACTIVE)
            ->get(['amount_usd', 'roi_percent_daily']);

        $total = '0.00';
        foreach ($investments as $investment) {
            $dailyPct = (string) ($investment->roi_percent_daily ?? '0');
            if (bccomp($dailyPct, '0', 4) <= 0) {
                continue;
            }

            $total = bcadd(
                $total,
                bcmul(
                    (string) $investment->amount_usd,
                    bcdiv($dailyPct, '100', 8),
                    8,
                ),
                8,
            );
        }

        return number_format((float) $total, 2, '.', '');
    }

    /**
     * @param  array{
     *     qual_rank: array<int, array<string, mixed>|null>,
     *     children: array<int, list<int>>
     * }  $context
     */
    protected function countSameRankQualifiedInLegSubtree(int $legRootId, float $targetPercent, array $context): int
    {
        $count = 0;
        $stack = [$legRootId];

        while ($stack !== []) {
            $userId = array_pop($stack);
            $rank = $context['qual_rank'][$userId] ?? null;

            if ($rank !== null && (float) ($rank['reward_percent'] ?? 0) === $targetPercent) {
                $count++;
            }

            foreach ($context['children'][$userId] ?? [] as $childId) {
                $stack[] = $childId;
            }
        }

        return $count;
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function rankWithUserId(int $userId, ?array $rank): ?array
    {
        if ($rank === null) {
            return null;
        }

        return array_merge($rank, ['user_id' => $userId]);
    }

    protected function amountFromPercent(string $baseUsd, float $percent): string
    {
        if ($percent <= 0 || bccomp($baseUsd, '0', 2) <= 0) {
            return '0.00';
        }

        return bcmul(
            $baseUsd,
            bcdiv(number_format($percent, 4, '.', ''), '100', 8),
            2,
        );
    }

    /**
     * @return array{
     *     total: string,
     *     generation_gap_usd: string,
     *     compression_usd: string,
     *     same_rank_usd: string,
     *     legs: list<array<string, mixed>>
     * }
     */
    protected function emptyPayout(): array
    {
        return [
            'total' => '0.00',
            'generation_gap_usd' => '0.00',
            'compression_usd' => '0.00',
            'same_rank_usd' => '0.00',
            'skip_level_usd' => '0.00',
            'legs' => [],
        ];
    }
}
