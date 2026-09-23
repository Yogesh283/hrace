<?php

use App\Models\LedgerEntry;

/**
 * RACE Community Rewards Program — member income hub (PDF only).
 */
return [
    'items' => [
        [
            'key' => 'participation_rewards',
            'label' => 'Staking Reward Rates',
            'short_label' => 'Staking',
            'types' => [
                LedgerEntry::TYPE_ROI_DAILY,
                LedgerEntry::TYPE_STAKE_UNLOCK_EMI,
                LedgerEntry::TYPE_COMPOUND_REINVEST,
            ],
            'route' => 'investment',
            'trigger' => '',
        ],
        [
            'key' => 'community_referrals',
            'label' => 'Community Referrals',
            'short_label' => 'Referrals',
            'types' => [LedgerEntry::TYPE_COMMUNITY_REFERRAL],
            'route' => 'transactions',
            'trigger' => '10-level one-time referral when downline stakes $50+ (L1 3% · L2–L3 1% · L4 0.50% · L5–L10 0.25%). Upline must be self $50+ active — no N-directs gate.',
        ],
        [
            'key' => 'affiliate_network_roi',
            'label' => 'ROI Sharing',
            'short_label' => 'ROI Share',
            'types' => [LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI],
            'route' => 'transactions',
            'trigger' => 'Level 1 (direct) only · up to 10% ROI-on-ROI from each direct’s daily staking ROI · unlimited directs · paid with income:pay-roi cron.',
        ],
        [
            'key' => 'community_leadership',
            'label' => 'Community Leadership',
            'short_label' => 'Leadership',
            'types' => [
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY,
            ],
            'route' => 'leadership',
            'trigger' => '11 ranks · 24h cron · ROI-of-ROI. Royalty Achievement: Rank 11 + direct Rank 11 → daily stops; both hold $10M full month → up to $5,000/mo.',
        ],
        [
            'key' => 'community_team_rewards',
            'label' => 'Community Team Rewards',
            'short_label' => 'Team Rewards',
            'types' => [LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD],
            'route' => 'rewards',
            'trigger' => '',
        ],
    ],
];
