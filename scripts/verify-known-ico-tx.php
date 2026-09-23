<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$tx = '0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8';

$events = App\Models\BlockchainEvent::query()
    ->where('tx_hash', $tx)
    ->orderBy('log_index')
    ->get(['event_name', 'log_index', 'block_number', 'contract_address', 'wallet_address']);

$purchase = App\Models\IcoPurchase::query()->where('tx_hash', $tx)->first();

echo json_encode([
    'tx' => $tx,
    'event_rows' => $events->count(),
    'events' => $events->toArray(),
    'ico_purchase' => $purchase?->toArray(),
], JSON_PRETTY_PRINT).PHP_EOL;
