<?php
$rpc = 'https://data-seed-prebsc-1-s1.binance.org:8545';
$ico = '0x9c227938885f5fe4f91826ec6db37ea54ac31c73';
$from = dechex(130724700);
$to = dechex(130724750);
$body = json_encode([
    'jsonrpc' => '2.0',
    'id' => 1,
    'method' => 'eth_getLogs',
    'params' => [[
        'address' => $ico,
        'fromBlock' => '0x'.$from,
        'toBlock' => '0x'.$to,
    ]],
]);
$ctx = stream_context_create(['http' => [
    'method' => 'POST',
    'header' => "Content-Type: application/json\r\n",
    'content' => $body,
    'timeout' => 30,
]]);
echo file_get_contents($rpc, false, $ctx);
