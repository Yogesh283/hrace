<?php

return [
    'enabled' => env('RACE_LENDING_ENABLED', false),

    'contract_address' => env('RACE_LENDING_CONTRACT', ''),

    'chain_id' => (int) env('RACE_LENDING_CHAIN_ID', env('BLOCKCHAIN_CHAIN_ID', 97)),

    'race_ico_address' => env('RACE_ICO_CONTRACT', ''),

    'usdt_treasury_address' => env('RACE_LENDING_USDT_TREASURY', ''),

    /*
    | Laravel is NOT financial authority — read chain/indexer only.
    */
    'abi_path' => base_path('contracts/artifacts/src/RaceLendingBorrowing.sol/RaceLendingBorrowing.json'),

    'indexer' => [
        'command' => 'blockchain:index-events',
        'confirmation_depth' => (int) env('RACE_LENDING_CONFIRMATION_DEPTH', 12),
    ],
];
