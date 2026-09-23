<?php

/**
 * ICO → stake → daily virtual Race Coin claim → wallet transfer ($1 USDT fee).
 *
 * Flow:
 * 1) User buys ICO RACE at fixed phase price and selects lock duration.
 * 2) Stake is locked at that purchase price (always shown on UI).
 * 3) Daily Claim credits virtual Race Coin (in-app balance).
 * 4) Transfer to wallet: user pays $1 USDT admin fee first, then Race Coin
 *    can be withdrawn to the connected wallet.
 */
return [

    'current_phase_id' => (int) env('ICO_CURRENT_PHASE_ID', 1),

    'phases' => [
        1 => ['price_usd' => 0.25, 'allocation_race' => 200_000, 'label' => 'Phase 1'],
        2 => ['price_usd' => 0.35, 'allocation_race' => 200_000, 'label' => 'Phase 2'],
        3 => ['price_usd' => 0.45, 'allocation_race' => 200_000, 'label' => 'Phase 3'],
    ],

    /*
    | ICO lock options — FIXED only (Flexible is post-ICO via Engine.participate).
    */
    'duration_tiers' => [
        ['days' => 180, 'label' => '180 Days', 'daily_reward_percent' => 0.50],
        ['days' => 365, 'label' => '365 Days', 'daily_reward_percent' => 0.70],
        ['days' => 730, 'label' => '730 Days', 'daily_reward_percent' => 0.90],
        ['days' => 1095, 'label' => '1095 Days', 'daily_reward_percent' => 1.00],
    ],

    /*
    | Transfer virtual Race Coin → connected wallet.
    | Fee is fixed $1 USDT (BEP20) to admin treasury, verified on-chain.
    */
    'wallet_transfer' => [
        'admin_fee_usdt' => 1.00,
        'min_coins' => 1.0,
        'fee_network' => 'BEP20',
    ],

    'claim' => [
        // One claim day = 24 hours from last successful claim (or stake start).
        'interval_hours' => 24,
    ],
];
