<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Race Coin — virtual token swapped from on-chain USDT
    |--------------------------------------------------------------------------
    | Swap display/credit follows the current ICO phase price
    | (Phase 1 $0.25, Phase 2 $0.35, Phase 3 $0.45) via RaceCoinService.
    | This fallback is used only if ICO phase config is missing.
    */
    'price_usd' => 0.25,

    'min_swap_usd' => 1.0,

    /*
    | ID activation via Race Coin costs the same USD value as the minimum
    | Built for Growth package ($50 at the current ICO phase price).
    */
    'id_activation_usd' => 50.0,

];
