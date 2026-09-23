<?php

$rpcs = [
    'https://data-seed-prebsc-2-s1.binance.org:8545',
    'https://data-seed-prebsc-1-s2.binance.org:8545',
    'https://bsc-testnet.publicnode.com',
];

function rpc(string $url, string $method, array $params): mixed
{
    $body = json_encode(['jsonrpc' => '2.0', 'id' => 1, 'method' => $method, 'params' => $params]);
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $body,
        'timeout' => 25,
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        return null;
    }
    $json = json_decode($raw, true);

    return $json['result'] ?? ($json['error'] ?? null);
}

$tx = '0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8';
$ico = '0x9c227938885f5fe4f91826ec6db37ea54ac31c73';
$block = 130724727;

foreach ($rpcs as $rpcUrl) {
    $chain = rpc($rpcUrl, 'eth_chainId', []);
    $receipt = rpc($rpcUrl, 'eth_getTransactionReceipt', [$tx]);
    $logs = rpc($rpcUrl, 'eth_getLogs', [[
        'address' => $ico,
        'fromBlock' => '0x'.dechex($block),
        'toBlock' => '0x'.dechex($block),
    ]]);
    echo json_encode([
        'rpc' => parse_url($rpcUrl, PHP_URL_HOST),
        'chainId' => is_string($chain) ? hexdec($chain) : $chain,
        'receipt_status' => is_array($receipt) ? ($receipt['status'] ?? null) : null,
        'receipt_to' => is_array($receipt) ? ($receipt['to'] ?? null) : null,
        'log_count' => is_array($logs) ? count($logs) : $logs,
    ], JSON_PRETTY_PRINT).PHP_EOL;
}
