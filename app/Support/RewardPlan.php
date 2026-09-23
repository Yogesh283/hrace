<?php

namespace App\Support;

use App\Models\SiteSetting;

/**
 * Read-only access to reward rules in config/reward_plan.php.
 * Payout / volume aggregation will call these helpers later.
 */
final class RewardPlan
{
    public static function mthPercentForLevel(int $level): ?float
    {
        $map = config('reward_plan.affiliate_mth_percent', []);

        return $map[$level] ?? null;
    }

    /**
     * @return array{connection_base_usd: float, level_percent: array<int, float>}
     */
    public static function affiliateTeamRewards(): array
    {
        return config('reward_plan.community_team_rewards', config('reward_plan.affiliate_team_rewards', [
            'wallet_withdrawal_fee' => [
                'min_amount_usd' => 1.0,
                'mode' => 'dual',
                'percent' => 10.0,
                'team_reward_percent' => 10.0,
                'destination' => 'community_team_rewards',
                'admin_fee' => [
                    'flat_usd' => 1.0,
                    'percent_from_usd' => 100.0,
                    'percent' => 1.0,
                ],
            ],
            'withdrawal_fee_percent' => 10.0,
            'level_percent' => [
                1 => 25.0, 2 => 15.0, 3 => 12.0, 4 => 10.0, 5 => 9.0,
                6 => 8.0, 7 => 6.0, 8 => 5.0, 9 => 5.0, 10 => 5.0,
            ],
        ]));
    }

    /**
     * User income / USDT wallet withdrawal fees (Laravel only) — dual deduction:
     *   Team Reward = 10% of gross → Community Team Rewards L1–L10 pool
     *   Admin Fee   = $1 if gross < 100; else 1% of gross → Admin/Treasury
     * Net = gross − team_reward − admin_fee.
     * Separate from on-chain fixed maturity 10% → RaceTreasury / EMI.
     *
     * @return array{
     *     fee_usd: string,
     *     team_reward_usd: string,
     *     admin_fee_usd: string,
     *     total_fee_usd: string,
     *     net_usd: string,
     *     mode: 'dual',
     *     percent: float,
     *     flat_fee_usd: string|null,
     *     admin_fee_mode: 'flat'|'percent'
     * }
     */
    public static function calculateWalletWithdrawalFee(string|float $grossAmountUsd): array
    {
        $cfg = self::affiliateTeamRewards()['wallet_withdrawal_fee'] ?? [];
        $percent = (float) ($cfg['team_reward_percent'] ?? $cfg['percent'] ?? self::affiliateTeamRewards()['withdrawal_fee_percent'] ?? 10);
        $gross = number_format((float) $grossAmountUsd, 2, '.', '');
        $teamReward = bcmul($gross, bcdiv(number_format($percent, 4, '.', ''), '100', 8), 2);
        $admin = self::calculatePayoutAdminFee($gross);
        $totalFee = bcadd($teamReward, $admin['admin_fee_usd'], 2);

        return [
            /** @deprecated Prefer team_reward_usd — kept as Team Reward pool for callers */
            'fee_usd' => $teamReward,
            'team_reward_usd' => $teamReward,
            'admin_fee_usd' => $admin['admin_fee_usd'],
            'total_fee_usd' => $totalFee,
            'net_usd' => bcsub($gross, $totalFee, 2),
            'mode' => 'dual',
            'percent' => $percent,
            'flat_fee_usd' => $admin['admin_fee_mode'] === 'flat' ? $admin['admin_fee_usd'] : null,
            'admin_fee_mode' => $admin['admin_fee_mode'],
        ];
    }

    /**
     * Cash-out Admin Fee (USDT): $1 flat when gross < 100; else 1% of gross.
     * Shared helper for income withdrawal (and any future USDT payout gate).
     * Not the fixed-maturity 10% RaceTreasury company fee.
     *
     * @return array{admin_fee_usd: string, admin_fee_mode: 'flat'|'percent'}
     */
    public static function calculatePayoutAdminFee(string|float $grossAmountUsd): array
    {
        $cfg = self::affiliateTeamRewards()['wallet_withdrawal_fee']['admin_fee'] ?? [];
        $gross = number_format((float) $grossAmountUsd, 2, '.', '');
        $threshold = number_format((float) ($cfg['percent_from_usd'] ?? 100), 2, '.', '');
        $flat = number_format((float) ($cfg['flat_usd'] ?? 1), 2, '.', '');
        $pct = (float) ($cfg['percent'] ?? 1);

        if (bccomp($gross, $threshold, 2) < 0) {
            return [
                'admin_fee_usd' => $flat,
                'admin_fee_mode' => 'flat',
            ];
        }

        $fee = bcmul($gross, bcdiv(number_format($pct, 4, '.', ''), '100', 8), 2);

        return [
            'admin_fee_usd' => $fee,
            'admin_fee_mode' => 'percent',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function walletWithdrawalFeeRulesForUi(): array
    {
        $cfg = self::affiliateTeamRewards()['wallet_withdrawal_fee'] ?? [];
        $adminCfg = $cfg['admin_fee'] ?? [];
        $percent = number_format((float) ($cfg['team_reward_percent'] ?? $cfg['percent'] ?? 10), 2, '.', '');
        $threshold = number_format((float) ($adminCfg['percent_from_usd'] ?? 100), 2, '.', '');
        $flatMax = bcsub($threshold, '0.01', 2);

        return [
            'min_amount_usd' => number_format((float) ($cfg['min_amount_usd'] ?? 1), 2, '.', ''),
            'mode' => 'dual',
            'percent' => $percent,
            'team_reward_percent' => $percent,
            'destination' => (string) ($cfg['destination'] ?? 'community_team_rewards'),
            'flat_fee_usd' => number_format((float) ($adminCfg['flat_usd'] ?? 1), 2, '.', ''),
            'flat_fee_max_gross_usd' => $flatMax,
            'percent_from_usd' => $threshold,
            'admin_fee_percent' => number_format((float) ($adminCfg['percent'] ?? 1), 2, '.', ''),
        ];
    }

    /**
     * @return array{enabled: bool, max_per_window: int, window_hours: int}
     */
    public static function walletWithdrawalRateLimit(): array
    {
        $cfg = self::affiliateTeamRewards()['rate_limit'] ?? [];

        return [
            'enabled' => (bool) ($cfg['enabled'] ?? true),
            'max_per_window' => max(1, (int) ($cfg['max_per_window'] ?? 2)),
            'window_hours' => max(1, (int) ($cfg['window_hours'] ?? 24)),
        ];
    }

    /**
     * @deprecated Prefer calculateWalletWithdrawalFee(); returns wallet withdraw fee %.
     */
    public static function withdrawalFeePercent(): float
    {
        $cfg = self::affiliateTeamRewards()['wallet_withdrawal_fee'] ?? [];

        return (float) ($cfg['percent'] ?? self::affiliateTeamRewards()['withdrawal_fee_percent'] ?? 10);
    }

    public static function teamRewardWeightForLevel(int $level): ?float
    {
        $map = self::affiliateTeamRewards()['level_percent'] ?? [];

        return isset($map[$level]) ? (float) $map[$level] : null;
    }

    /** @deprecated Use teamRewardWeightForLevel */
    public static function teamRewardPercentForLevel(int $level): ?float
    {
        return self::teamRewardWeightForLevel($level);
    }

    public static function teamRewardWeightSum(): string
    {
        $sum = '0';
        foreach (self::affiliateTeamRewards()['level_percent'] ?? [] as $weight) {
            $sum = bcadd($sum, (string) $weight, 4);
        }

        return $sum;
    }

    /**
     * @return list<array{level: int, percent: float, share_of_fee_percent: float, example_usd: float}>
     */
    public static function teamRewardLadder(): array
    {
        $cfg = self::affiliateTeamRewards();
        $exampleGross = (float) ($cfg['example_withdrawal_usd'] ?? 100);
        $feeCalc = self::calculateWalletWithdrawalFee($exampleGross);
        $feePool = (float) ($feeCalc['team_reward_usd'] ?? $feeCalc['fee_usd']);
        $sum = (float) self::teamRewardWeightSum();
        $out = [];
        foreach ($cfg['level_percent'] ?? [] as $level => $weight) {
            $level = (int) $level;
            $w = (float) $weight;
            $shareOfFee = $sum > 0 ? ($w / $sum) * 100 : 0;
            $out[] = [
                'level' => $level,
                'percent' => $w,
                'share_of_fee_percent' => round($shareOfFee, 2),
                'example_usd' => $sum > 0 ? round($feePool * ($w / $sum), 2) : 0,
            ];
        }

        return $out;
    }

    /**
     * @deprecated Fixed milestone bonuses are disabled; use r10LeadershipRanks() for live rules.
     *
     * @return list<array{code: string, volume_usd: float|int, reward_usd: float|int}>
     */
    public static function r10Milestones(): array
    {
        $cfg = config('reward_plan.affiliate_r10_milestones', []);

        return $cfg['legacy_reference'] ?? (is_array($cfg) && ! isset($cfg['pay_fixed_bonus']) ? $cfg : []);
    }

    public static function r10MilestoneBonusesEnabled(): bool
    {
        return (bool) config('reward_plan.affiliate_r10_milestones.pay_fixed_bonus', false);
    }

    public static function r10LeadershipTeamVolumePercentForLevel(int $level): ?float
    {
        $map = config('reward_plan.affiliate_r10_leadership.team_volume_percent', []);

        return isset($map[$level]) ? (float) $map[$level] : null;
    }

    public static function r10LevelFromCode(string $code): ?int
    {
        if (preg_match('/^R(\d{1,2})$/i', trim($code), $m)) {
            $level = (int) $m[1];

            return ($level >= 1 && $level <= 10) ? $level : null;
        }

        return null;
    }

    /**
     * @return list<array{
     *     code: string,
     *     level: int,
     *     self_hold_increment_usd: float,
     *     team_volume_increment_usd: float,
     *     self_hold_usd: float,
     *     team_volume_usd: float,
     *     team_volume_percent: float,
     *     month_reward_percent: float
     * }>
     */
    public static function r10LeadershipRanks(): array
    {
        $rows = config('reward_plan.affiliate_r10_leadership.ranks', []);
        $out = [];
        $cumSelf = 0.0;
        $cumTeam = 0.0;

        foreach ($rows as $row) {
            $level = (int) ($row['level'] ?? 0);
            if ($level < 1) {
                $level = self::r10LevelFromCode((string) ($row['code'] ?? '')) ?? 0;
            }

            $usesAbsolute = array_key_exists('self_hold_usd', $row) || array_key_exists('team_volume_usd', $row);

            if ($usesAbsolute) {
                $selfUsd = (float) ($row['self_hold_usd'] ?? 0);
                $teamUsd = (float) ($row['team_volume_usd'] ?? 0);
            } else {
                $cumSelf += (float) ($row['self_hold_increment_usd'] ?? 0);
                $cumTeam += (float) ($row['team_volume_increment_usd'] ?? 0);
                $selfUsd = $cumSelf;
                $teamUsd = $cumTeam;
            }

            $pct = self::r10LeadershipTeamVolumePercentForLevel($level)
                ?? (float) ($row['team_volume_percent'] ?? $row['month_reward_percent'] ?? 0);

            $out[] = [
                'code' => (string) ($row['code'] ?? ('R'.$level)),
                'level' => $level,
                'self_hold_increment_usd' => (float) ($row['self_hold_increment_usd'] ?? 0),
                'team_volume_increment_usd' => (float) ($row['team_volume_increment_usd'] ?? 0),
                'self_hold_usd' => $selfUsd,
                'team_volume_usd' => $teamUsd,
                'team_volume_percent' => $pct,
                'month_reward_percent' => $pct,
            ];
        }

        return $out;
    }

    public static function sponsorPercentForLevel(int $level): ?float
    {
        $map = config('reward_plan.affiliate_sponsor_percent', []);

        return $map[$level] ?? null;
    }

    public static function investment(): array
    {
        return config('reward_plan.investment', []);
    }

    public static function affiliateReferralPercentForLevel(int $level): ?float
    {
        $map = config('reward_plan.community_referral_percent', config('reward_plan.affiliate_referral_percent', []));

        return $map[$level] ?? null;
    }

    public static function communityReferralPercentForLevel(int $level): ?float
    {
        return self::affiliateReferralPercentForLevel($level);
    }

    /**
     * @return list<array{level: int, self_hold_usd: float|int, team_volume_usd: float|int, direct_required: int, reward_percent: float}>
     */
    public static function communityLeadershipRanks(): array
    {
        return config('reward_plan.community_leadership.ranks', []);
    }

    public static function communityLeadershipMinDirects(): int
    {
        return (int) config('reward_plan.community_leadership.min_qualified_directs', 2);
    }

    public static function communityLeadershipCycleHours(): int
    {
        return (int) config('reward_plan.community_leadership.distribution_cycle_hours', 24);
    }

    public static function communityLeadershipSkipLevelPercent(): float
    {
        return (float) config('reward_plan.community_leadership.skip_level_percent', 5.0);
    }

    public static function communityLeadershipSameRankPercent(): float
    {
        return (float) config('reward_plan.community_leadership.same_rank_percent', 5.0);
    }

    public static function communityLeadershipSameRankMaxPerLineage(): int
    {
        return (int) config('reward_plan.community_leadership.same_rank_max_per_lineage', 1);
    }

    /** Rank 1 may still earn same_rank_percent; Rank 2–11 are blocked on same-rank legs. */
    public static function communityLeadershipSameRankAllowPercentUpToRank(): int
    {
        return (int) config('reward_plan.community_leadership.same_rank_allow_percent_up_to_rank', 1);
    }

    public static function communityLeadershipSameRankBlockFromRank(): int
    {
        return (int) config('reward_plan.community_leadership.same_rank_block_from_rank', 2);
    }

    public static function communityLeadershipRank11MonthlyBonusEnabled(): bool
    {
        return (bool) config('reward_plan.community_leadership.rank_11_monthly_bonus.enabled', true);
    }

    public static function communityLeadershipRank11MonthlyRewardUsd(): float
    {
        return (float) config('reward_plan.community_leadership.rank_11_monthly_bonus.reward_usd', 5000.0);
    }

    public static function communityLeadershipRank11RequiredTeamVolumeUsd(): float
    {
        return (float) config(
            'reward_plan.community_leadership.rank_11_monthly_bonus.required_team_volume_usd',
            10_000_000.0,
        );
    }

    public static function communityLeadershipRank11RequiredRank(): int
    {
        return (int) config('reward_plan.community_leadership.rank_11_monthly_bonus.required_rank', 11);
    }

    public static function communityLeadershipRank11RequiresTeamMember(): bool
    {
        return (bool) config('reward_plan.community_leadership.rank_11_monthly_bonus.require_team_member_rank_11', true);
    }

    /** Royalty Achievement: Rank 11 partner must be a direct (L1), not deeper downline. */
    public static function communityLeadershipRank11RequiresDirectTeamMember(): bool
    {
        return (bool) config(
            'reward_plan.community_leadership.rank_11_monthly_bonus.require_direct_team_member_rank_11',
            true,
        );
    }

    public static function communityLeadershipRank11StopDailyWhenTeamHasRank11(): bool
    {
        return (bool) config(
            'reward_plan.community_leadership.rank_11_monthly_bonus.stop_daily_when_team_has_rank_11',
            true,
        );
    }

    public static function compoundingEnabled(): bool
    {
        return (bool) config('reward_plan.compounding.enabled', false);
    }

    public static function holdingRolloverEnabled(): bool
    {
        return (bool) config('reward_plan.holding_rollover.enabled', true);
    }

    public static function holdingRolloverHours(): int
    {
        return max(1, (int) config('reward_plan.holding_rollover.rollover_hours', 24));
    }

    public static function roiSharingEnabled(): bool
    {
        return (bool) config(
            'reward_plan.roi_sharing.enabled',
            config('reward_plan.affiliate_network_roi.enabled', true),
        );
    }

    /** Level-1 (direct) ROI-on-ROI percent — official graphic: up to 10%. */
    public static function roiSharingDirectPercent(): float
    {
        $fromSharing = config('reward_plan.roi_sharing.direct_roi_of_roi_percent');
        if ($fromSharing !== null) {
            return (float) $fromSharing;
        }

        return (float) (config('reward_plan.affiliate_network_roi.roi_of_roi_percent.1', 10.0));
    }

    public static function networkRoiOfRoiPercentForLevel(int $level): ?float
    {
        if ($level === 1) {
            return self::roiSharingDirectPercent();
        }

        $map = config('reward_plan.affiliate_network_roi.roi_of_roi_percent', []);

        return $map[$level] ?? null;
    }

    /**
     * @return array{
     *     min_amount_usd: float,
     *     max_amount_usd: float,
     *     duration_tiers: list<array{days: int, daily_roi_percent: float}>
     * }
     */
    public static function builtForGrowth(): array
    {
        $cfg = config('reward_plan.participation_tiers', config('reward_plan.built_for_growth', []));

        return [
            'min_amount_usd' => (float) ($cfg['min_amount_usd'] ?? 1.0),
            'qualifying_amount_usd' => (float) ($cfg['qualifying_amount_usd'] ?? 50.0),
            'max_amount_usd' => (float) ($cfg['max_amount_usd'] ?? 999_999_999.99),
            'duration_tiers' => array_map(static function (array $tier): array {
                return [
                    'days' => (int) ($tier['days'] ?? 0),
                    'daily_roi_percent' => (float) ($tier['daily_reward_percent'] ?? $tier['daily_roi_percent'] ?? 0),
                    'label' => $tier['label'] ?? null,
                ];
            }, $cfg['duration_tiers'] ?? []),
        ];
    }

    public static function participationQualifyingMinUsd(): float
    {
        return (float) (self::builtForGrowth()['qualifying_amount_usd'] ?? 50.0);
    }

    public static function isQualifyingParticipationAmount(string $amountUsd): bool
    {
        $min = number_format(self::participationQualifyingMinUsd(), 2, '.', '');

        return bccomp(number_format((float) $amountUsd, 2, '.', ''), $min, 2) >= 0;
    }

    /** @return list<int> */
    public static function growthAllowedDurations(): array
    {
        return array_values(array_map(
            static fn (array $tier): int => (int) ($tier['days'] ?? 0),
            self::builtForGrowth()['duration_tiers'] ?? [],
        ));
    }

    public static function growthDurationIsAllowed(int $days): bool
    {
        return in_array($days, self::growthAllowedDurations(), true);
    }

    /**
     * @return array{days: int, daily_roi_percent: float}|null
     */
    public static function growthDurationTierForDays(int $days): ?array
    {
        foreach (self::builtForGrowth()['duration_tiers'] ?? [] as $tier) {
            if ((int) ($tier['days'] ?? 0) === $days) {
                return $tier;
            }
        }

        return null;
    }

    public static function growthDailyPercentForDuration(int $days): ?float
    {
        $tier = self::growthDurationTierForDays($days);
        if ($tier === null) {
            return null;
        }

        return round((float) ($tier['daily_roi_percent'] ?? 0), 6);
    }

    /** @deprecated Amount tiers removed; use growthDailyPercentForDuration */
    public static function growthAmountTierForAmount(string $amountUsd): ?array
    {
        return null;
    }

    /** @deprecated Use growthDurationTierForDays */
    public static function growthTierForAmount(string $amountUsd): ?array
    {
        return self::growthAmountTierForAmount($amountUsd);
    }

    /** @deprecated Use growthDailyPercentForDuration */
    public static function growthDailyPercentForAmount(string $amountUsd): ?float
    {
        return null;
    }

    public static function stakeWithdrawFeePercent(): float
    {
        return (float) config(
            'reward_plan.participation_tiers.stake_withdraw_fee_percent',
            self::withdrawalFeePercent(),
        );
    }

    /**
     * Stake principal unlock: 10% admin fee now, 90% in 3×30% EMIs.
     * Flexible held ≥ flexible_fee_free_after_days → 0% fee.
     *
     * @return array{
     *     admin_fee_percent: float,
     *     emi_count: int,
     *     emi_percent_each: float,
     *     interval_days: int,
     *     flexible_fee_free_after_days: int
     * }
     */
    public static function stakeUnlockRules(): array
    {
        $cfg = config('reward_plan.participation_tiers.stake_unlock', []);

        return [
            'admin_fee_percent' => (float) ($cfg['admin_fee_percent'] ?? 10.0),
            'emi_count' => (int) ($cfg['emi_count'] ?? 3),
            'emi_percent_each' => (float) ($cfg['emi_percent_each'] ?? 30.0),
            'interval_days' => max(1, (int) ($cfg['interval_days'] ?? 30)),
            'flexible_fee_free_after_days' => max(0, (int) ($cfg['flexible_fee_free_after_days'] ?? 10)),
        ];
    }

    /**
     * Admin fee % for this stake unlock (Flexible after N days = 0).
     */
    public static function stakeUnlockAdminFeePercentFor(\App\Models\Investment $investment): float
    {
        $rules = self::stakeUnlockRules();
        $defaultFee = (float) $rules['admin_fee_percent'];

        if ((int) $investment->duration_days !== 0) {
            return $defaultFee;
        }

        $freeAfter = (int) $rules['flexible_fee_free_after_days'];
        if ($freeAfter <= 0 || $investment->created_at === null) {
            return $defaultFee;
        }

        $heldDays = $investment->created_at->diffInDays(now());

        return $heldDays >= $freeAfter ? 0.0 : $defaultFee;
    }

    public static function builtForGrowthDurationTiersForUi(): array
    {
        $out = [];

        foreach (self::builtForGrowth()['duration_tiers'] ?? [] as $tier) {
            $days = (int) ($tier['days'] ?? 0);
            $label = $tier['label'] ?? ($days === 0 ? 'Flexible' : ($days.' days'));

            $out[] = [
                'days' => $days,
                'label' => $label,
                'daily_roi_percent' => number_format((float) ($tier['daily_roi_percent'] ?? $tier['daily_reward_percent'] ?? 0), 2, '.', ''),
            ];
        }

        return $out;
    }

    /**
     * @return list<array{days: int, label: string, daily_roi_percent: string}>
     */
    public static function builtForGrowthDurationOptionsForUi(): array
    {
        return self::builtForGrowthDurationTiersForUi();
    }

    /** @deprecated Use builtForGrowthDurationTiersForUi */
    public static function builtForGrowthAmountTiersForUi(): array
    {
        return self::builtForGrowthDurationTiersForUi();
    }

    /** @deprecated Use builtForGrowthDurationTiersForUi */
    public static function builtForGrowthTiersForUi(): array
    {
        return self::builtForGrowthDurationTiersForUi();
    }

    /**
     * @return array{enabled: bool, trigger?: string}
     */
    public static function idActivation(): array
    {
        return config('reward_plan.id_activation', [
            'enabled' => true,
            'trigger' => 'first_investment',
        ]);
    }

    public static function idActivationEnabled(): bool
    {
        return (bool) (self::idActivation()['enabled'] ?? false);
    }

    /**
     * @return array{direct_sponsor_usd: float, grandparent_usd: float}
     */
    public static function affiliatePlacement(): array
    {
        return config('reward_plan.affiliate_placement', [
            'enabled' => false,
            'direct_sponsor_usd' => 1.0,
            'grandparent_usd' => 5.0,
        ]);
    }

    public static function affiliatePlacementEnabled(): bool
    {
        return (bool) (self::affiliatePlacement()['enabled'] ?? false);
    }

    /**
     * @return array{
     *     required_qualified_directs: int,
     *     direct_activate_within_days: int,
     *     direct_monthly_bonus_percent: float,
     *     days_per_month: int
     * }
     */
    public static function bonzaRank(): array
    {
        return config('reward_plan.bonza_rank', [
            'required_qualified_directs' => 2,
            'direct_activate_within_days' => 7,
            'direct_monthly_bonus_percent' => 2.0,
            'days_per_month' => 30,
        ]);
    }

    /**
     * @return array{enabled: bool, direct_percent: float}
     */
    public static function bonzaBuster(): array
    {
        return [
            'enabled' => SiteSetting::bonzaBusterEnabled(),
            'direct_percent' => SiteSetting::bonzaBusterDirectPercent(),
        ];
    }

    public static function bonzaBusterDirectPercent(): ?float
    {
        if (! SiteSetting::bonzaBusterEnabled()) {
            return null;
        }

        return SiteSetting::bonzaBusterDirectPercent();
    }

    public static function binaryRecycle(): array
    {
        return config('reward_plan.binary_recycle', []);
    }
}
