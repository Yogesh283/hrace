<?php

/**
 * Audit: ICO purchases (DB) vs instant level income (CommunityReferralPaid on-chain + indexer).
 *
 * Run on live server:
 *   cd /home/racenetwork/htdocs/racenetwork.live
 *   php scripts/audit-ico-level-income.php
 */

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\BlockchainEvent;
use App\Models\IcoPurchase;
use App\Models\IncomeWalletTransaction;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

const QUALIFYING_USDT = 50.0;
const COMMUNITY_REFERRAL_TOPIC = '0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966';
const ICO_STAKE_CREATED_TOPIC = '0x3bbaced029028afbe3622c5c505c56f82a87ba3bfd76b003656a0147f83db5ee';

function rpcUrl(): string
{
    return \App\Support\BlockchainRpc::primaryRpcUrl();
}

function ethGetTransactionReceipt(string $txHash): ?array
{
    $response = Http::timeout(25)->post(rpcUrl(), [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'eth_getTransactionReceipt',
        'params' => [$txHash],
    ]);

    if (! $response->successful()) {
        return null;
    }

    return $response->json('result');
}

function countLogsByTopic(?array $receipt, string $topic0): int
{
    if (! is_array($receipt) || ! isset($receipt['logs']) || ! is_array($receipt['logs'])) {
        return -1;
    }
    $topic0 = strtolower($topic0);
    $n = 0;
    foreach ($receipt['logs'] as $log) {
        $t0 = strtolower((string) ($log['topics'][0] ?? ''));
        if ($t0 === $topic0) {
            $n++;
        }
    }

    return $n;
}

echo '=== ICO Level Income Audit ==='.PHP_EOL;
echo 'chain_id='.\App\Support\BlockchainMode::effectiveChainId().PHP_EOL;
echo 'engine='.config('blockchain.contracts.community_engine').PHP_EOL;
echo 'ico='.config('blockchain.contracts.ico').PHP_EOL;
echo 'rpc='.rpcUrl().PHP_EOL.PHP_EOL;

if (! Schema::hasTable('ico_purchases')) {
    echo 'STOP: ico_purchases table missing'.PHP_EOL;
    exit(1);
}

$total = IcoPurchase::query()->count();
echo "ico_purchases_total={$total}".PHP_EOL;

$purchases = IcoPurchase::query()->orderBy('id')->get();
$qualifying = $purchases->filter(static function ($p) {
    return (float) $p->usdt_amount >= QUALIFYING_USDT;
});

echo 'qualifying_usdt_50plus='. $qualifying->count().PHP_EOL.PHP_EOL;

$summary = [
    'ok_on_chain_referral' => 0,
    'missing_on_chain_referral' => 0,
    'below_qualifying' => 0,
    'receipt_unavailable' => 0,
    'indexed_community_referral_event' => 0,
    'db_level_income_rows' => 0,
];

$rows = [];

foreach ($purchases as $p) {
    $usdt = (float) $p->usdt_amount;
    $tx = strtolower((string) $p->tx_hash);
    $userId = $p->user_id;
    $memberId = $userId ? (string) $userId : 'null';

    if ($usdt < QUALIFYING_USDT) {
        $summary['below_qualifying']++;
        continue;
    }

    $receipt = $tx !== '' ? ethGetTransactionReceipt($tx) : null;
    $refLogs = countLogsByTopic($receipt, COMMUNITY_REFERRAL_TOPIC);
    $stakeLogs = countLogsByTopic($receipt, ICO_STAKE_CREATED_TOPIC);

    $indexedRefEvents = BlockchainEvent::query()
        ->where('tx_hash', $tx)
        ->where('event_name', 'CommunityReferralPaid')
        ->count();

    $levelIncomeDb = 0;
    if ($userId && Schema::hasTable('income_wallet_transactions')) {
        $levelIncomeDb = IncomeWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('type', IncomeWalletTransaction::TYPE_LEVEL_INCOME)
            ->where('source_reference', 'like', '%'.$tx.'%')
            ->count();
    }

    $expectedReferral = true;
    $onChainOk = $refLogs > 0;
    if ($receipt === null) {
        $summary['receipt_unavailable']++;
        $status = 'RECEIPT_UNAVAILABLE';
    } elseif ($onChainOk) {
        $summary['ok_on_chain_referral']++;
        $status = 'LEVEL_INCOME_ON_CHAIN_OK';
    } else {
        $summary['missing_on_chain_referral']++;
        $status = 'NO_COMMUNITY_REFERRAL_IN_TX';
    }

    if ($indexedRefEvents > 0) {
        $summary['indexed_community_referral_event']++;
    }
    $summary['db_level_income_rows'] += $levelIncomeDb;

    $sponsorWallet = null;
    if ($refLogs > 0 && is_array($receipt)) {
        foreach ($receipt['logs'] as $log) {
            if (strtolower((string) ($log['topics'][0] ?? '')) !== strtolower(COMMUNITY_REFERRAL_TOPIC)) {
                continue;
            }
            $raw = (string) ($log['topics'][1] ?? '');
            if (strlen($raw) >= 42) {
                $sponsorWallet = '0x'.substr($raw, -40);
                break;
            }
        }
    }

    $rows[] = [
        'purchase_id' => $p->purchase_id,
        'user_id' => $memberId,
        'wallet' => $p->wallet_address,
        'sponsor_from_event' => $sponsorWallet,
        'usdt' => $p->usdt_amount,
        'tx' => $tx,
        'status' => $status,
        'on_chain_referral_logs' => $refLogs,
        'on_chain_ico_stake_logs' => $stakeLogs,
        'indexer_community_referral_rows' => $indexedRefEvents,
        'laravel_level_income_rows_for_tx' => $levelIncomeDb,
    ];
}

echo '--- Summary (qualifying $50+ ICO only) ---'.PHP_EOL;
echo json_encode($summary, JSON_PRETTY_PRINT).PHP_EOL.PHP_EOL;

echo '--- Per purchase (qualifying) ---'.PHP_EOL;
foreach ($rows as $row) {
    echo json_encode($row, JSON_UNESCAPED_SLASHES).PHP_EOL;
}

echo PHP_EOL.'Note: Instant ICO level income is paid as on-chain RACE to sponsor (CommunityReferralPaid).'.PHP_EOL;
echo 'Laravel virtual level_income rows may be 0 in blockchain_only mode — check sponsor wallet RACE on BscScan.'.PHP_EOL;
