<?php

/**
 * Platform income claim (Laravel staking ROI) — separate from on-chain Engine claim.
 *
 * Accrual: income:pay-roi (same formulas).
 * Claim: moves accrued → virtual USDT wallet; no Admin Fee.
 * Withdrawal: WithdrawalService applies Team Reward + Admin Fee when funds leave platform.
 */
return [

    'claim' => [
        'interval_hours' => (int) env('INCOME_CLAIM_INTERVAL_HOURS', 24),
    ],

];
