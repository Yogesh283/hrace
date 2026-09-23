<?php

/**
 * Virtual Income Wallet — unified earned-income ledger (Laravel authority).
 * On-chain staking/mint state remains on BSC; this tracks off-chain USDT-notional income.
 */
return [

    'asset_default' => 'USDT',

    /*
    | Map legacy ledger entry_type → income_wallet_transactions.type (source still in metadata).
    */
    'ledger_type_map' => [
        'roi_daily' => \App\Models\IncomeWalletTransaction::TYPE_DAILY_REWARD,
        'roi_monthly' => \App\Models\IncomeWalletTransaction::TYPE_DAILY_REWARD,
        'roi_accrual' => null,
        'income_claim' => \App\Models\IncomeWalletTransaction::TYPE_INCOME_CLAIM,
        'affiliate_network_roi' => \App\Models\IncomeWalletTransaction::TYPE_LEVEL_INCOME,
        'community_leadership' => \App\Models\IncomeWalletTransaction::TYPE_LEVEL_INCOME,
        'community_leadership_rank11_monthly' => \App\Models\IncomeWalletTransaction::TYPE_LEVEL_INCOME,
        'affiliate_r10_leadership' => \App\Models\IncomeWalletTransaction::TYPE_LEVEL_INCOME,
        'community_team_reward' => \App\Models\IncomeWalletTransaction::TYPE_TEAM_INCOME,
        'affiliate_team_reward' => \App\Models\IncomeWalletTransaction::TYPE_TEAM_INCOME,
        'referral_direct' => \App\Models\IncomeWalletTransaction::TYPE_REFERRAL_INCOME,
        'community_referral' => \App\Models\IncomeWalletTransaction::TYPE_REFERRAL_INCOME,
        'affiliate_referral' => \App\Models\IncomeWalletTransaction::TYPE_REFERRAL_INCOME,
        'activation_referral' => \App\Models\IncomeWalletTransaction::TYPE_REFERRAL_INCOME,
        'affiliate_mth' => \App\Models\IncomeWalletTransaction::TYPE_OTHER_INCOME,
        'bonza_direct_bonus' => \App\Models\IncomeWalletTransaction::TYPE_OTHER_INCOME,
        'bonza_buster' => \App\Models\IncomeWalletTransaction::TYPE_OTHER_INCOME,
        'stake_unlock_emi' => \App\Models\IncomeWalletTransaction::TYPE_STAKE_UNLOCK_EMI,
        'compound_reinvest' => \App\Models\IncomeWalletTransaction::TYPE_COMPOUND,
        'wallet_withdrawal' => \App\Models\IncomeWalletTransaction::TYPE_WITHDRAWAL,
    ],

    /*
    | Ledger types that must NOT mirror (deposits, investment debits, company fees, accrual-only).
    */
    'mirror_exclude' => [
        'wallet_deposit',
        'investment_debit',
        'withdrawal_admin_fee',
        'stake_unlock_admin_fee',
        'roi_accrual',
        'wallet_withdrawal',
    ],

    'compound_reserve_ttl_hours' => (int) env('COMPOUND_RESERVE_TTL_HOURS', 24),

];
