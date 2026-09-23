<?php

/**
 * On-chain Income Vault (RaceIncomeVault) — read model + settlement config.
 * Authoritative balance: blockchain (indexed), not Laravel ledger math.
 */
return [

    'enabled' => filter_var(env('INCOME_VAULT_ENABLED', false), FILTER_VALIDATE_BOOL),

    /** When true, UI/API balance comes from indexer; VirtualIncomeWalletService delegates here. */
    'authoritative_balance' => filter_var(env('INCOME_VAULT_AUTHORITATIVE', false), FILTER_VALIDATE_BOOL),

    'contract_address' => env('RACE_INCOME_VAULT_CONTRACT', ''),

    /** BEP20 settlement token (USDT-notional; same as virtual_income_wallet.asset_default). */
    'settlement_token' => env('INCOME_VAULT_SETTLEMENT_TOKEN', env('USDT_CONTRACT_BEP20', '')),

    'settlement_signer' => env('INCOME_VAULT_SETTLEMENT_SIGNER', ''),

    'admin_fee_recipient' => env('INCOME_VAULT_ADMIN_FEE_RECIPIENT', ''),

    'liquidity_pool' => env('INCOME_VAULT_LIQUIDITY_POOL', ''),

    'settlement_private_key' => env('INCOME_VAULT_SETTLEMENT_PRIVATE_KEY', ''),

    'domain' => [
        'name' => 'RaceIncomeVault',
        'version' => '1',
    ],

    /**
     * Map Laravel IncomeWalletTransaction::TYPE_* → RaceIncomeVault bytes32 (keccak256(label)).
     */
    'income_type_labels' => [
        \App\Models\IncomeWalletTransaction::TYPE_DAILY_REWARD => 'daily_reward',
        \App\Models\IncomeWalletTransaction::TYPE_LEVEL_INCOME => 'level_income',
        \App\Models\IncomeWalletTransaction::TYPE_TEAM_INCOME => 'team_income',
        \App\Models\IncomeWalletTransaction::TYPE_REFERRAL_INCOME => 'referral_income',
        \App\Models\IncomeWalletTransaction::TYPE_OTHER_INCOME => 'other_income',
        \App\Models\IncomeWalletTransaction::TYPE_INCOME_CLAIM => 'income_claim',
        \App\Models\IncomeWalletTransaction::TYPE_STAKE_UNLOCK_EMI => 'stake_unlock_emi',
    ],

    'indexer' => [
        'enabled' => filter_var(env('INCOME_VAULT_INDEXER_ENABLED', true), FILTER_VALIDATE_BOOL),
    ],

    /** When true, Laravel income crons cannot credit virtual wallet without on-chain settlement pipeline. */
    'settlement_required' => filter_var(env('INCOME_VAULT_SETTLEMENT_REQUIRED', false), FILTER_VALIDATE_BOOL),

    /** When authoritative, legacy Laravel withdrawal API remains available if true (default true until vault UAT). */
    'legacy_withdrawal_enabled' => filter_var(env('INCOME_VAULT_LEGACY_WITHDRAWAL', true), FILTER_VALIDATE_BOOL),

];
