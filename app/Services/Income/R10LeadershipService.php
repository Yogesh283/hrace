<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\RewardPlan;
use Carbon\Carbon;

class R10LeadershipService
{
    public function __construct(
        protected ReferralTree $tree,
    ) {}

    public function selfActiveHoldUsd(int $userId): string
    {
        $sum = Investment::query()
            ->where('user_id', $userId)
            ->where('status', Investment::STATUS_ACTIVE)
            ->sum('amount_usd');

        return number_format((float) $sum, 2, '.', '');
    }

    public function downlineTeamVolumeUsd(int $userId): string
    {
        return $this->tree->downlineInvestmentVolumeUsd($userId);
    }

    /**
     * Team business at one network depth only (R1 → level 1, R2 → level 2, … R10 → level 10).
     */
    public function networkLevelTeamVolumeUsd(int $userId, int $level): string
    {
        return $this->tree->downlineInvestmentVolumeUsdAtLevel($userId, $level);
    }

    /**
     * Highest leadership rank row the member satisfies (self hold + that rank's level team volume).
     *
     * @return array{
     *     code: string,
     *     level: int,
     *     self_hold_usd: float,
     *     team_volume_usd: float,
     *     team_volume_percent: float,
     *     month_reward_percent: float
     * }|null
     */
    public function qualifyingRankRow(int $userId, string $selfHoldUsd): ?array
    {
        $current = null;
        foreach (RewardPlan::r10LeadershipRanks() as $row) {
            $level = (int) ($row['level'] ?? 0);
            if ($level < 1) {
                continue;
            }
            $levelTeamVolumeUsd = $this->networkLevelTeamVolumeUsd($userId, $level);
            $needSelf = number_format((float) ($row['self_hold_usd'] ?? 0), 2, '.', '');
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            if (bccomp($selfHoldUsd, $needSelf, 2) >= 0 && bccomp($levelTeamVolumeUsd, $needTeam, 2) >= 0) {
                $current = $row;
            }
        }

        return $current;
    }

    /**
     * All ranks the member satisfies (self hold + that rank's level team volume).
     *
     * @return list<array<string, mixed>>
     */
    public function qualifyingRankRows(int $userId, string $selfHoldUsd): array
    {
        $out = [];
        foreach (RewardPlan::r10LeadershipRanks() as $row) {
            $level = (int) ($row['level'] ?? 0);
            if ($level < 1) {
                continue;
            }
            $levelTeamVolumeUsd = $this->networkLevelTeamVolumeUsd($userId, $level);
            $needSelf = number_format((float) ($row['self_hold_usd'] ?? 0), 2, '.', '');
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            if (bccomp($selfHoldUsd, $needSelf, 2) >= 0 && bccomp($levelTeamVolumeUsd, $needTeam, 2) >= 0) {
                $out[] = $row;
            }
        }

        return $out;
    }

    /**
     * Highest rank where only team volume at that level is met (ignores self hold).
     *
     * @return array<string, mixed>|null
     */
    public function highestRankByTeamVolumeOnly(int $userId): ?array
    {
        $current = null;
        foreach (RewardPlan::r10LeadershipRanks() as $row) {
            $level = (int) ($row['level'] ?? 0);
            if ($level < 1) {
                continue;
            }
            $levelTeamVolumeUsd = $this->networkLevelTeamVolumeUsd($userId, $level);
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            if (bccomp($levelTeamVolumeUsd, $needTeam, 2) >= 0) {
                $current = $row;
            }
        }

        return $current;
    }

    public function selfHoldRequiredAtMonthlyClosing(): bool
    {
        return (bool) config('reward_plan.affiliate_r10_leadership.self_hold_required_at_monthly_closing', true);
    }

    /**
     * @return array{
     *     current_period: string,
     *     payout_period: string,
     *     self_hold_required_at_closing: bool,
     *     self_hold_ok: bool,
     *     self_hold_lapsed: bool,
     *     qualified_rank_code: string|null,
     *     would_be_rank_code: string|null,
     *     lapse_message: string|null,
     *     closing_note: string
     * }
     */
    public function monthlyClosingContext(int $userId, string $selfHoldUsd): array
    {
        $current = $this->qualifyingRankRow($userId, $selfHoldUsd);
        $teamOnly = $this->highestRankByTeamVolumeOnly($userId);
        $lapsed = $this->selfHoldRequiredAtMonthlyClosing()
            && $current === null
            && $teamOnly !== null;

        $closingNote = 'Self hold must be complete at month closing (payout on the 1st). '
            .'If your active package is below the rank’s self hold at closing, that month’s leadership income lapses. '
            .'Meet self hold again in the next month to earn.';

        return [
            'current_period' => Carbon::now()->format('Y-m'),
            'payout_period' => Carbon::now()->subMonth()->format('Y-m'),
            'self_hold_required_at_closing' => $this->selfHoldRequiredAtMonthlyClosing(),
            'self_hold_ok' => $current !== null,
            'self_hold_lapsed' => $lapsed,
            'qualified_rank_code' => $current['code'] ?? null,
            'would_be_rank_code' => $lapsed ? ($teamOnly['code'] ?? null) : null,
            'lapse_message' => $lapsed
                ? 'Team volume qualifies for '.($teamOnly['code'] ?? 'a rank')
                    .' but self hold is short. At closing this month will lapse unless you restore self hold.'
                : null,
            'closing_note' => $closingNote,
        ];
    }

    /**
     * Payout eligibility at monthly closing (self hold + team volume for that rank’s level).
     *
     * @return array{eligible: bool, rank: array<string, mixed>|null, self_hold_lapsed: bool, would_be_rank_code: string|null}
     */
    public function evaluatePayoutEligibility(int $userId, string $selfHoldUsd): array
    {
        $rank = $this->qualifyingRankRow($userId, $selfHoldUsd);
        if ($rank !== null) {
            return [
                'eligible' => true,
                'rank' => $rank,
                'self_hold_lapsed' => false,
                'would_be_rank_code' => null,
            ];
        }

        $teamOnly = $this->highestRankByTeamVolumeOnly($userId);
        $lapsed = $this->selfHoldRequiredAtMonthlyClosing() && $teamOnly !== null;

        return [
            'eligible' => false,
            'rank' => null,
            'self_hold_lapsed' => $lapsed,
            'would_be_rank_code' => $lapsed ? ($teamOnly['code'] ?? null) : null,
        ];
    }

    /**
     * Live ledger rows for R1–R10 (self hold + per-level team volume).
     *
     * @return array<string, mixed>
     */
    public function liveDataLedgerFor(User $user): array
    {
        $self = $this->selfActiveHoldUsd($user->id);
        $closing = $this->monthlyClosingContext($user->id, $self);
        $rows = [];

        foreach (RewardPlan::r10LeadershipRanks() as $row) {
            $rankLevel = (int) ($row['level'] ?? 0);
            $levelTeam = $rankLevel >= 1
                ? $this->networkLevelTeamVolumeUsd($user->id, $rankLevel)
                : '0.00';
            $needSelf = number_format((float) ($row['self_hold_usd'] ?? 0), 2, '.', '');
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            $selfMet = bccomp($self, $needSelf, 2) >= 0;
            $teamMet = bccomp($levelTeam, $needTeam, 2) >= 0;
            $qualified = $selfMet && $teamMet;
            $estimated = $qualified
                ? $this->estimatedMonthlyPayUsd($levelTeam, $row)
                : '0.00';

            $rows[] = [
                'rank_code' => (string) ($row['code'] ?? ''),
                'network_level' => $rankLevel,
                'required_self_hold_usd' => (float) $needSelf,
                'live_self_hold_usd' => (float) $self,
                'required_team_volume_usd' => (float) $needTeam,
                'live_team_volume_usd' => (float) $levelTeam,
                'billable_team_volume_usd' => (float) $this->billableTeamVolumeUsd($levelTeam, $row),
                'team_volume_percent' => (float) ($row['team_volume_percent'] ?? $row['month_reward_percent'] ?? 0),
                'estimated_earned_usd' => (float) $estimated,
                'self_hold_met' => $selfMet,
                'team_volume_met' => $teamMet,
                'qualified' => $qualified,
                'income_eligible_at_closing' => $qualified,
            ];
        }

        return [
            'program_name' => 'Affiliate R10 Leadership',
            'live_self_hold_usd' => $self,
            'rows' => $rows,
            'closing' => $closing,
        ];
    }

    /**
     * Team volume used for monthly pay — full level volume (no cap).
     * Rank team_volume_usd is the minimum to qualify only (e.g. R1 needs ≥ $10k level-1; pay on all level-1 volume).
     */
    public function billableTeamVolumeUsd(string $teamVolumeUsd, ?array $rankRow): string
    {
        if ($rankRow === null) {
            return '0.00';
        }

        if (bccomp($teamVolumeUsd, '0', 2) <= 0) {
            return '0.00';
        }

        return number_format((float) $teamVolumeUsd, 2, '.', '');
    }

    public function estimatedMonthlyPayUsd(string $teamVolumeUsd, ?array $rankRow): string
    {
        if ($rankRow === null) {
            return '0.00';
        }
        $pct = (float) ($rankRow['team_volume_percent'] ?? $rankRow['month_reward_percent'] ?? 0);
        if ($pct <= 0) {
            return '0.00';
        }

        $billable = $this->billableTeamVolumeUsd($teamVolumeUsd, $rankRow);

        return bcmul(
            $billable,
            bcdiv(number_format($pct, 4, '.', ''), '100', 8),
            2,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function pagePropsFor(User $user): array
    {
        $self = $this->selfActiveHoldUsd($user->id);
        $current = $this->qualifyingRankRow($user->id, $self);
        $teamLevel = $current ? (int) ($current['level'] ?? 1) : 1;
        // Total downline volume (all levels) for a clearer headline metric on the member page.
        $downlineTotal = $this->downlineTeamVolumeUsd($user->id);

        // Current rank's network level volume (R1 = level 1 only, ...).
        $team = $this->networkLevelTeamVolumeUsd($user->id, $teamLevel);
        $ranks = RewardPlan::r10LeadershipRanks();
        $billableTeam = $this->billableTeamVolumeUsd($team, $current);
        $estimatedMonthly = $this->estimatedMonthlyPayUsd($team, $current);

        $next = null;
        if ($current) {
            $seen = false;
            foreach ($ranks as $row) {
                if ($seen) {
                    $next = $row;
                    break;
                }
                if (($row['code'] ?? '') === ($current['code'] ?? '')) {
                    $seen = true;
                }
            }
        } else {
            $next = $ranks[0] ?? null;
        }

        $ladder = [];
        foreach ($ranks as $row) {
            $rankLevel = (int) ($row['level'] ?? 0);
            $levelTeam = $rankLevel >= 1
                ? $this->networkLevelTeamVolumeUsd($user->id, $rankLevel)
                : '0.00';
            $needSelf = number_format((float) ($row['self_hold_usd'] ?? 0), 2, '.', '');
            $needTeam = number_format((float) ($row['team_volume_usd'] ?? 0), 2, '.', '');
            $selfMet = bccomp($self, $needSelf, 2) >= 0;
            $teamMet = bccomp($levelTeam, $needTeam, 2) >= 0;
            $tierMet = $selfMet && $teamMet;
            $pct = (float) ($row['team_volume_percent'] ?? $row['month_reward_percent'] ?? 0);
            $needSelfF = (float) $needSelf;
            $needTeamF = (float) $needTeam;
            $selfF = (float) $self;
            $teamF = (float) $levelTeam;
            $ladder[] = [
                'code' => (string) ($row['code'] ?? ''),
                'level' => $rankLevel,
                'self_hold_increment_usd' => (float) ($row['self_hold_increment_usd'] ?? 0),
                'team_volume_increment_usd' => (float) ($row['team_volume_increment_usd'] ?? 0),
                'required_self_hold_usd' => $needSelfF,
                'required_team_volume_usd' => $needTeamF,
                'self_hold_usd' => $needSelfF,
                'team_volume_usd' => $needTeamF,
                'live_self_hold_usd' => $selfF,
                'live_team_volume_usd' => $teamF,
                'billable_team_volume_usd' => (float) $this->billableTeamVolumeUsd($levelTeam, $row),
                'team_volume_percent' => $pct,
                'month_reward_percent' => $pct,
                'estimated_earned_usd' => (float) ($tierMet
                    ? $this->estimatedMonthlyPayUsd($levelTeam, $row)
                    : '0.00'),
                'self_hold_met' => $selfMet,
                'team_volume_met' => $teamMet,
                'tier_met' => $tierMet,
                'is_current' => $current && ($row['code'] ?? '') === ($current['code'] ?? ''),
            ];
        }

        $nextSelf = $next ? (float) ($next['self_hold_usd'] ?? 0) : null;
        $nextTeam = $next ? (float) ($next['team_volume_usd'] ?? 0) : null;
        $nextLevel = $next ? (int) ($next['level'] ?? 0) : 0;
        $nextLevelTeam = $nextLevel >= 1
            ? (float) $this->networkLevelTeamVolumeUsd($user->id, $nextLevel)
            : 0.0;
        $selfF = (float) $self;

        $progress = null;
        if ($nextSelf !== null && $nextTeam !== null) {
            $progress = [
                'self_pct' => $nextSelf > 0 ? min(100, ($selfF / $nextSelf) * 100) : 100,
                'team_pct' => $nextTeam > 0 ? min(100, ($nextLevelTeam / $nextTeam) * 100) : 100,
                'need_self_usd' => max(0, $nextSelf - $selfF),
                'need_team_usd' => max(0, $nextTeam - $nextLevelTeam),
            ];
        }

        $last = LedgerEntry::query()
            ->production()
            ->where('user_id', $user->id)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP)
            ->latest('id')
            ->first(['amount_usd', 'created_at', 'meta']);

        $currentLeadership = null;
        if ($current) {
            $lvl = (int) ($current['level'] ?? 0);
            $currentLeadership = [
                'program_name' => 'Affiliate R10 Leadership',
                'level' => $lvl,
                'level_label' => 'Level '.$lvl,
                'rank_code' => (string) ($current['code'] ?? ''),
                'team_volume_percent' => (float) ($current['team_volume_percent'] ?? $current['month_reward_percent'] ?? 0),
            ];
        }

        $nextLeadership = null;
        if ($next) {
            $lvl = (int) ($next['level'] ?? 0);
            $nextLeadership = [
                'program_name' => 'Affiliate R10 Leadership',
                'level' => $lvl,
                'level_label' => 'Level '.$lvl,
                'rank_code' => (string) ($next['code'] ?? ''),
            ];
        }

        $closing = $this->monthlyClosingContext($user->id, $self);

        return [
            'program_name' => 'Affiliate R10 Leadership',
            'self_hold_usd' => $self,
            'team_volume_usd' => $downlineTotal,
            'rank_level_team_volume_usd' => $team,
            'billable_team_volume_usd' => $billableTeam,
            'current_leadership' => $currentLeadership,
            'next_leadership' => $nextLeadership,
            'current_rank' => $current,
            'next_rank' => $next,
            'estimated_monthly_pay_usd' => $estimatedMonthly,
            'ladder' => $ladder,
            'monthly_closing' => $closing,
            'progress_to_next' => $progress,
            'last_payout' => $last ? [
                'amount_usd' => number_format((float) $last->amount_usd, 2, '.', ''),
                'at' => $last->created_at?->toIso8601String(),
                'period' => is_array($last->meta) ? ($last->meta['period'] ?? null) : null,
                'rank_code' => is_array($last->meta) ? ($last->meta['rank_code'] ?? null) : null,
                'level' => is_array($last->meta) ? ($last->meta['level'] ?? null) : null,
            ] : null,
            'payout_note' => 'Monthly pay = full team volume at your rank’s network level × reward % (no cap above the qualify minimum). R1 = all level-1 business ≥ $10k qualifies; pay on full amount e.g. $11k × 1%. Self hold required at month closing. Paid on the 1st.',
        ];
    }
}

