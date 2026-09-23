<?php

/*
|--------------------------------------------------------------------------
| ISU Coin — Initial Sale
|--------------------------------------------------------------------------
| Member sends USDT (BEP20) on-chain to the company treasury. A verified
| transfer credits ISU coins and immediately opens a staking position
| (Investment) for the same USD amount, so daily staking rewards start
| right away — no separate "start staking" step.
*/
return [
    'price_usd' => (float) env('ISU_PRICE_USD', 0.05),

    'coin_symbol' => 'ISU',

    'coin_name' => 'ISU Coin',
];
