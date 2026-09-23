<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Race Coin — virtual token swapped from on-chain USDT
    |--------------------------------------------------------------------------
    | Price is fixed at $0.10 per Race Coin. User sends USDT from their
    | connected crypto wallet; verified on-chain credits virtual Race Coins.
    */
    'price_usd' => 0.10,

    'min_swap_usd' => 1.0,

    /*
    | ID activation via Race Coin costs the same USD value as the minimum
    | Built for Growth package ($50 → 500 coins at $0.10 each).
    */
    'id_activation_usd' => 50.0,

];
