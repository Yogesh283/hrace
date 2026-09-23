<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Legacy RaceParticipation.sol (deprecated — do not route users here)
    |--------------------------------------------------------------------------
    | When false (default), Laravel/frontend/indexer must not use the legacy
    | participation contract. Active staking uses RaceCommunityEngine only.
    */
    'legacy' => [
        'application_enabled' => filter_var(env('RACE_LEGACY_PARTICIPATION_ENABLED', false), FILTER_VALIDATE_BOOL),
    ],

    /*
    |--------------------------------------------------------------------------
    | On-chain Participation Program (RaceParticipation.sol)
    |--------------------------------------------------------------------------
    | When enabled, daily RACE rewards and staking are handled entirely by the
    | smart contract. Laravel does NOT calculate participation ROI.
    */
    'on_chain' => [
        'enabled' => filter_var(env('PARTICIPATION_ON_CHAIN', false), FILTER_VALIDATE_BOOL),

        'chain_id' => (int) env('BSC_CHAIN_ID', 56),

        'rpc_url' => env('BSC_RPC_URL', 'https://bsc-dataseed.binance.org/'),

        'participation_contract' => env('RACE_PARTICIPATION_CONTRACT', ''),

        'usdt_contract' => env('USDT_CONTRACT_BEP20', '0x55d398326f99059ff775485246999027b3197955'),

        'pancake_router' => env('PANCAKE_ROUTER', '0x10ED43C718714eb63d5aA57B78B54704E256024E'),

        'min_confirmations' => max(1, (int) env('PARTICIPATION_MIN_CONFIRMATIONS', 3)),

        'min_usdt' => 1.0,
        'qualifying_usdt' => 50.0,
    ],

    'lock_periods' => [
        ['days' => 0, 'seconds' => 0, 'label' => 'Flexible', 'daily_rate_bps' => 50],
        ['days' => 180, 'seconds' => 180 * 86400, 'label' => '180 Days', 'daily_rate_bps' => 50],
        ['days' => 365, 'seconds' => 365 * 86400, 'label' => '365 Days', 'daily_rate_bps' => 70],
        ['days' => 730, 'seconds' => 730 * 86400, 'label' => '730 Days', 'daily_rate_bps' => 90],
        ['days' => 1095, 'seconds' => 1095 * 86400, 'label' => '1095 Days', 'daily_rate_bps' => 100],
    ],

    /** Staking principal unlock fee (10%) — mirrors RaceCommunityEngine WITHDRAWAL_FEE_BPS */
    'stake_withdraw_fee_bps' => 1000,

    'events' => [
        'participation_purchased' => '0x771e2f913fe17bca4c8610ec22f97692df4570133fa1f02f726012e653b14e81',
    ],

];
