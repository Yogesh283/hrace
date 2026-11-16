<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Race Coin — virtual token swapped from on-chain USDT
    |--------------------------------------------------------------------------
    | Display + Internal Swap quote use live Pancake RACE/USDT via
    | RacePancakePriceService (RaceICO.liveStakePriceUsdt / Engine).
    | price_usd below is config fallback only if RPC/pool fails AND
    | ICO phase config is missing.
    */
    'price_usd' => 0.25,

    'min_swap_usd' => 1.0,

    /*
    | ID activation via Race Coin costs the same USD value as the minimum
    | Built for Growth package ($50 at the current ICO phase price).
    */
    'id_activation_usd' => 50.0,

];
