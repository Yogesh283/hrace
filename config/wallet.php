<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Admin treasury address (BEP20 / BNB Smart Chain)
    |--------------------------------------------------------------------------
    |
    | Public deposit address shown to members when the database value is empty.
    | Set ADMIN_WALLET_BEP20 in .env, or set the address in the admin panel
    | (Treasury deposit address) — the panel value overrides when not blank.
    |
    */

    'admin_bep20_address' => env(
        'ADMIN_WALLET_BEP20',
        '0xa6eD3cF59F3eaf6c4ee7DB1247212F7B13D6B595',
    ),

    'admin_network_label' => env('ADMIN_WALLET_NETWORK_LABEL', 'BEP20 (BNB Smart Chain)'),

    /*
    |--------------------------------------------------------------------------
    | USDT BEP20 contract address (BSC mainnet)
    |--------------------------------------------------------------------------
    */
    'usdt_contract_bep20' => env('USDT_CONTRACT_BEP20', '0x55d398326f99059ff775485246999027b3197955'),

    /*
    |--------------------------------------------------------------------------
    | BSCScan API key — for on-chain tx verification
    | Get free key at https://bscscan.com/myapikey
    |--------------------------------------------------------------------------
    */
    'bscscan_api_key' => env('BSCSCAN_API_KEY', ''),

    /*
    |--------------------------------------------------------------------------
    | On-chain deposit security
    |--------------------------------------------------------------------------
    */
    'deposit_min_confirmations' => (int) env('DEPOSIT_MIN_CONFIRMATIONS', 12),

    'usdt_decimals' => 18,

    'usdt_symbol' => 'USDT',

];
