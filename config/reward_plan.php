<?php

/**
 * RACE Community Rewards Program — rules from RACE Community Rewards.pdf only.
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Participation Reward Rates (Staking Tiers) — PDF pages 13–14
    |--------------------------------------------------------------------------
    */
    'participation_tiers' => [
        'min_amount_usd' => 1.0,
        'qualifying_amount_usd' => 50.0,
        'max_amount_usd' => 999_999_999.99,
        /*
        | RACE Network Staking Participation Program (official rates)
        | Stake unlock fee remains stake_withdraw_fee_percent (10%).
        */
        'duration_tiers' => [
            ['days' => 0, 'label' => 'Flexible', 'daily_reward_percent' => 0.35],
            ['days' => 180, 'label' => '180 Days', 'daily_reward_percent' => 0.50],
            ['days' => 365, 'label' => '365 Days', 'daily_reward_percent' => 0.70],
            ['days' => 730, 'label' => '730 Days', 'daily_reward_percent' => 0.90],
            ['days' => 1095, 'label' => '1095 Days', 'daily_reward_percent' => 1.00],
        ],
        'stake_withdraw_fee_percent' => 10.0,
        /*
        | After unlock request / lock end:
        | 10% → admin USDT BEP20 wallet immediately
        | 90% → user in 3 EMIs of 30% each (every interval_days)
        | Flexible exception: after flexible_fee_free_after_days → 0% fee (full principal in EMIs)
        */
        'stake_unlock' => [
            'admin_fee_percent' => 10.0,
            'emi_count' => 3,
            'emi_percent_each' => 30.0,
            'interval_days' => 30,
            'flexible_fee_free_after_days' => 10,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Optional Compounding — PDF page 7
    |--------------------------------------------------------------------------
    */
    'compounding' => [
        'enabled' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Community Referrals — one-time on each qualifying stake ($50+)
    |--------------------------------------------------------------------------
    | Paid immediately when downline creates staking (not daily).
    | Official graphic: L1 3% · L2–L3 1% · L4 0.50% · L5–L10 0.25%
    | Gate: upline must be self $50+ active and not blocked (no N-directs gate).
    */
    'community_referral_percent' => [
        1 => 3.0,
        2 => 1.0,
        3 => 1.0,
        4 => 0.50,
        5 => 0.25,
        6 => 0.25,
        7 => 0.25,
        8 => 0.25,
        9 => 0.25,
        10 => 0.25,
    ],

    /*
    |--------------------------------------------------------------------------
    | ROI Sharing Framework — Level 1 (direct) only
    |--------------------------------------------------------------------------
    | When a direct earns daily staking ROI, their sponsor gets up to 10% of that ROI.
    | Unlimited directs (no cap on how many directs). Paid by income:pay-roi cron.
    | Not L2–L10. Separate from Community Leadership ranks.
    */
    'roi_sharing' => [
        'enabled' => true,
        'direct_roi_of_roi_percent' => 10.0,
    ],

    /** @deprecated Use roi_sharing — kept for AffiliateNetworkRoiPageService / ledger meta */
    'affiliate_network_roi' => [
        'enabled' => true,
        'max_level' => 1,
        'roi_of_roi_percent' => [
            1 => 10.0,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Community Leadership — PDF pages 16–17
    |--------------------------------------------------------------------------
    */
    /*
    |--------------------------------------------------------------------------
    | Community Leadership — PDF ranks; pay = team daily ROI × reward_percent
    |--------------------------------------------------------------------------
    | Qualify: self_hold + team_volume + directs. Payout (ROI of ROI):
    |   sum(downline active stake daily ROI) × rank reward_percent / 100
    | Team volume / generation depth: unlimited (no fixed L1–L10 cap).
    | Community referral income remains L1–L10 only.
    |--------------------------------------------------------------------------
    */
    'community_leadership' => [
        'min_qualified_directs' => 2,
        'distribution_cycle_hours' => 24,
        /*
        | Official graphic (Community Leadership Reward Rules):
        | - Same rank (1 person in lineage): upstream gets 5%
        | - Skip-level (2+ same rank in lineage): upstream gets skip_level_percent (5%)
        | - Rank 2–11: same-rank leg blocked ($0) until you upgrade
        */
        'skip_level_percent' => 5.0,
        'same_rank_percent' => 5.0,
        'same_rank_max_per_lineage' => 1,
        'same_rank_allow_percent_up_to_rank' => 1,
        'same_rank_block_from_rank' => 2,
        'ranks' => [
            ['level' => 1, 'self_hold_usd' => 50, 'team_volume_usd' => 2_000, 'direct_required' => 2, 'reward_percent' => 10.0],
            ['level' => 2, 'self_hold_usd' => 100, 'team_volume_usd' => 5_000, 'direct_required' => 3, 'reward_percent' => 20.0],
            ['level' => 3, 'self_hold_usd' => 250, 'team_volume_usd' => 10_000, 'direct_required' => 4, 'reward_percent' => 30.0],
            ['level' => 4, 'self_hold_usd' => 500, 'team_volume_usd' => 25_000, 'direct_required' => 5, 'reward_percent' => 40.0],
            ['level' => 5, 'self_hold_usd' => 1_000, 'team_volume_usd' => 60_000, 'direct_required' => 6, 'reward_percent' => 50.0],
            ['level' => 6, 'self_hold_usd' => 2_000, 'team_volume_usd' => 130_000, 'direct_required' => 7, 'reward_percent' => 60.0],
            ['level' => 7, 'self_hold_usd' => 3_000, 'team_volume_usd' => 300_000, 'direct_required' => 8, 'reward_percent' => 70.0],
            ['level' => 8, 'self_hold_usd' => 4_000, 'team_volume_usd' => 700_000, 'direct_required' => 9, 'reward_percent' => 80.0],
            ['level' => 9, 'self_hold_usd' => 5_000, 'team_volume_usd' => 2_000_000, 'direct_required' => 10, 'reward_percent' => 90.0],
            ['level' => 10, 'self_hold_usd' => 7_000, 'team_volume_usd' => 5_000_000, 'direct_required' => 11, 'reward_percent' => 100.0],
            ['level' => 11, 'self_hold_usd' => 10_000, 'team_volume_usd' => 10_000_000, 'direct_required' => 12, 'reward_percent' => 110.0],
        ],
        /*
        | Royalty Achievement (Rank 11 monthly — official graphic):
        | - Qualify: you Rank 11 + at least ONE DIRECT also Rank 11
        | - Then Community Leadership daily Rank 11 reward STOPS
        | - Monthly up to $5,000 if BOTH maintain $10,000,000 team volume full month
        | - Paid by income:pay-community-leadership-rank11-monthly (previous month)
        */
        'rank_11_monthly_bonus' => [
            'enabled' => true,
            'required_rank' => 11,
            'required_team_volume_usd' => 10_000_000,
            'reward_usd' => 5_000.0,
            'require_team_member_rank_11' => true,
            /** Official: partner must be a Level-1 direct (not deeper downline). */
            'require_direct_team_member_rank_11' => true,
            'stop_daily_when_team_has_rank_11' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Community Team Rewards + Admin Fee — USER INCOME / USDT wallet withdrawal
    |--------------------------------------------------------------------------
    | Official path: Laravel WithdrawalService (earned income ledger → BEP20 USDT).
    | TWO SEPARATE deductions from gross:
    |   A) Team Reward = 10% of gross → L1–L10 (unqualified → admin ledger remainder)
    |   B) Admin Fee  = $1 flat if gross < 100; else 1% of gross → Admin/Treasury
    | Net = gross − team_reward − admin_fee.
    | NOT applied to: fixed maturity RaceTreasury fee, on-chain EMI claim, Flexible Engine exit,
    | ROI claim, compound, ICO. Flexible on-chain exit still uses Engine RACE team rewards.
    */
    'community_team_rewards' => [
        'wallet_withdrawal_fee' => [
            'min_amount_usd' => 1.0,
            'mode' => 'dual',
            'percent' => 10.0,
            'team_reward_percent' => 10.0,
            'destination' => 'community_team_rewards',
            'admin_fee' => [
                'flat_usd' => 1.0,
                /** Gross below this threshold uses flat_usd; at/above uses percent. */
                'percent_from_usd' => 100.0,
                'percent' => 1.0,
            ],
        ],
        'withdrawal_fee_percent' => 10.0,
        'example_withdrawal_usd' => 100.0,
        /*
        | Rate limit: max N requests in a rolling window_hours.
        | Example: 2 withdrawals at 5 PM and 6 PM → next after tomorrow 5 PM
        | (oldest frees), then after 6 PM (second frees). Rejected still counts.
        */
        'rate_limit' => [
            'enabled' => true,
            'max_per_window' => 2,
            'window_hours' => 24,
        ],
        'level_percent' => [
            1 => 25.0,
            2 => 15.0,
            3 => 12.0,
            4 => 10.0,
            5 => 9.0,
            6 => 8.0,
            7 => 6.0,
            8 => 5.0,
            9 => 5.0,
            10 => 5.0,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Holding rollover — T&C page 22
    |--------------------------------------------------------------------------
    | After fixed-lock holding ends, member has rollover_hours to unlock stake.
    | If not unlocked, principal auto-rolls into the same lock cycle again.
    | Flexible (0 days) is excluded (ongoing until user unlocks).
    */
    'holding_rollover' => [
        'enabled' => true,
        'rollover_hours' => 24,
    ],

    'id_activation' => [
        'enabled' => true,
        'trigger' => 'first_investment',
    ],
];
