<?php

/**
 * Read-only: fetch Inertia page props for client UAT config verification.
 * Does not send transactions.
 */
$base = getenv('APP_URL') ?: 'http://127.0.0.1:8000';
$paths = ['/ico', '/race-token'];

foreach ($paths as $path) {
    $url = rtrim($base, '/').$path;
    $html = @file_get_contents($url);
    if ($html === false) {
        echo "FAIL fetch {$path}\n";
        continue;
    }
    if (! preg_match('/data-page="([^"]+)"/', $html, $m)) {
        echo "FAIL no inertia data-page {$path}\n";
        continue;
    }
    $json = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5);
    $page = json_decode($json, true);
    $props = $page['props'] ?? [];
    $blockchain = $props['blockchain'] ?? [];
    $out = [
        'path' => $path,
        'component' => $page['component'] ?? null,
        'chain_id' => $blockchain['chain_id'] ?? null,
        'is_testnet' => $blockchain['is_testnet'] ?? null,
        'network' => $blockchain['network'] ?? null,
        'ico_contract' => $props['web3Ico']['ico_contract'] ?? ($blockchain['ico']['ico_contract'] ?? null),
        'race_token' => $props['token']['race_token'] ?? ($blockchain['token']['race_token'] ?? null),
        'usdt' => $blockchain['contracts']['usdt'] ?? null,
        'mainnet_usdt' => '0x55d398326f99059ff775485246999027b3197955',
        'mainnet_router' => '0x10ed43c718714eb63d5aa57b78b54704e256024e',
    ];
    echo json_encode($out, JSON_PRETTY_PRINT)."\n";
}
