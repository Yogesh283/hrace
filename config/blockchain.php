<?php

/**
 * RACE Web3 — single source of truth configuration.
 *
 * When rewards_engine is "blockchain_only", Laravel MUST NOT calculate or credit rewards.
 * Laravel only indexes events and serves read-only dashboards.
 */
return [

    'rewards_engine' => env('REWARDS_ENGINE', 'hybrid'), // hybrid | blockchain_only

    /** bsc | bsc_testnet — derived from BSC_NETWORK or chain id */
    'network' => env('BSC_NETWORK', ((int) env('BSC_CHAIN_ID', 56)) === 97 ? 'bsc_testnet' : 'bsc'),

    'chain_id' => (int) env('BSC_CHAIN_ID', 56),

    'rpc_url' => env('BSC_RPC_URL', 'https://bsc-dataseed.binance.org/'),

    /** Ordered RPC endpoints for indexer / resilient reads (primary first). */
    'rpc_urls' => array_values(array_unique(array_filter([
        env('BSC_RPC_URL'),
        env('BSC_RPC_URL_FALLBACK_1'),
        env('BSC_RPC_URL_FALLBACK_2'),
        env('BSC_TESTNET_RPC_FALLBACK_1'),
        env('BSC_TESTNET_RPC_FALLBACK_2'),
    ]))),

    'ws_url' => env('BSC_WS_URL', ''),

    'confirmations' => max(1, (int) env('BLOCKCHAIN_CONFIRMATIONS', 3)),

    'contracts' => [
        'race_token' => env('RACE_TOKEN_CONTRACT', ''),
        'community_engine' => env(
            'RACE_COMMUNITY_ENGINE_CONTRACT',
            env('RACE_COMMUNITY_ENGINE_ADDRESS', env('RACE_COMMUNITY_ENGINE', '')),
        ),
        'participation' => env('RACE_PARTICIPATION_CONTRACT', ''),
        'reward_vault' => env('RACE_REWARD_VAULT_CONTRACT', ''),
        'reward_price_oracle' => env('RACE_REWARD_PRICE_ORACLE_CONTRACT', ''),
        'treasury' => env('RACE_TREASURY_CONTRACT', ''),
        'development_treasury' => env('RACE_DEVELOPMENT_TREASURY_CONTRACT', ''),
        'marketing_treasury' => env('RACE_MARKETING_TREASURY_CONTRACT', ''),
        'operations_treasury' => env('RACE_OPERATIONS_TREASURY_CONTRACT', ''),
        'multisig' => env('RACE_MULTISIG_CONTRACT', ''),
        'governance' => env('RACE_GOVERNANCE_CONTRACT', ''),
        'governor_legacy' => env('RACE_GOVERNOR_CONTRACT', ''),
        'governor' => env('RACE_GOVERNOR_CONTRACT', ''),
        'staking' => env('RACE_STAKING_CONTRACT', ''),
        'reward_pool' => env('RACE_REWARD_POOL_CONTRACT', ''),
        'auto_liquidity' => env('RACE_AUTO_LIQUIDITY_CONTRACT', ''),
        'liquidity_locker' => env('RACE_LIQUIDITY_LOCKER_CONTRACT', ''),
        'ico' => env('RACE_ICO_CONTRACT', ''),
        'ico_reserve' => env('ICO_CONTRACT', ''),
        'ico_admin_wallet' => env('ICO_ADMIN_WALLET', ''),
        'income_vault' => env('RACE_INCOME_VAULT_CONTRACT', ''),
        'income_hold' => env('RACE_INCOME_HOLD_CONTRACT', ''),
        // Testnet must override — never leave mainnet defaults when BSC_CHAIN_ID=97
        'pancake_router' => env('PANCAKE_ROUTER', '0x10ED43C718714eb63d5aA57B78B54704E256024E'),
        'usdt' => env('USDT_CONTRACT_BEP20', '0x55d398326f99059ff775485246999027b3197955'),
    ],

    /** Mirror CommunityReferralPaid into income_wallet_transactions (RACE asset, read-model only). */
    'community_referral_mirror' => [
        'enabled' => filter_var(env('BLOCKCHAIN_COMMUNITY_REFERRAL_MIRROR', true), FILTER_VALIDATE_BOOL),
    ],

    'indexer' => [
        'enabled' => filter_var(env('BLOCKCHAIN_INDEXER_ENABLED', true), FILTER_VALIDATE_BOOL),
        'batch_size' => max(10, (int) env('BLOCKCHAIN_INDEXER_BATCH', 2000)),
        'start_block' => (int) env('BLOCKCHAIN_INDEXER_START_BLOCK', 0),
        'log_chunk_size' => max(1, (int) env('BLOCKCHAIN_INDEXER_LOG_CHUNK', 250)),
        'rpc_retries' => max(1, min(5, (int) env('BLOCKCHAIN_INDEXER_RPC_RETRIES', 3))),
        'rpc_timeout' => max(5, (int) env('BLOCKCHAIN_INDEXER_RPC_TIMEOUT', 25)),
        'rpc_urls' => array_values(array_unique(array_filter([
            env('BLOCKCHAIN_INDEXER_RPC_URL'),
            env('BLOCKCHAIN_INDEXER_RPC_URL_FALLBACK_1'),
            env('BLOCKCHAIN_INDEXER_RPC_URL_FALLBACK_2'),
            env('BSC_RPC_URL'),
            env('BSC_RPC_URL_FALLBACK_1'),
            env('BSC_RPC_URL_FALLBACK_2'),
            env('BSC_TESTNET_RPC_FALLBACK_1'),
            env('BSC_TESTNET_RPC_FALLBACK_2'),
        ]))),
    ],

];
