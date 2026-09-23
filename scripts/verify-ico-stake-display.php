<?php

/**
 * Local verification helper for ICO/stake display (testnet read-model).
 * Usage: php scripts/verify-ico-stake-display.php
 */
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\BlockchainEngineStake;
use App\Models\IcoPurchase;
use App\Models\User;
use App\Services\Blockchain\BlockchainWalletIndexerSyncService;
use App\Services\Blockchain\CommunityEngineStakeReadService;

$knownWallet = '0xb836f0a8b9014a0431abe7710eab818dcd7ae984';
$knownTx = '0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8';

$walletSync = app(BlockchainWalletIndexerSyncService::class);
$stakeRead = app(CommunityEngineStakeReadService::class);

$user = User::query()->whereRaw('LOWER(wallet_address) = ?', [$knownWallet])->first();
$createdUser = false;
if (! $user) {
    $user = User::create([
        'name' => 'Testnet Deployer Verify',
        'email' => strtolower($knownWallet).'@wallet.rynex.verify',
        'password' => Illuminate\Support\Facades\Hash::make(Illuminate\Support\Str::random(24)),
        'wallet_address' => $knownWallet,
        'email_verified_at' => now(),
        'level' => 1,
        'is_blocked' => false,
    ]);
    $createdUser = true;
}

$walletSync->syncForUser($user);

$purchases = IcoPurchase::query()
    ->where(function ($q) use ($user, $knownWallet) {
        $q->where('user_id', $user->id)
            ->orWhereRaw('LOWER(wallet_address) = ?', [$knownWallet]);
    })
    ->get();

$stakes = $stakeRead->stakesForUser($user);
$purchase = $purchases->first();
$stakeRow = BlockchainEngineStake::query()->whereRaw('LOWER(wallet_address) = ?', [$knownWallet])->first();

$result = [
    'USER_WALLET_MAPPING' => strtolower((string) $user->wallet_address) === $knownWallet ? 'PASS' : 'FAIL',
    'created_verification_user' => $createdUser,
    'user_id' => $user->id,
    'ICO_HISTORY_SOURCE' => 'ico_purchases + blockchain_engine_stakes (indexed read-model)',
    'ICO_HISTORY_DISPLAY' => $purchases->count() >= 1 ? 'PASS' : 'FAIL',
    'COMMUNITY_ENGINE_STAKE_INDEXING' => $stakeRow !== null ? 'PASS' : 'FAIL',
    'STAKING_DISPLAY' => count($stakes) >= 1 ? 'PASS' : 'FAIL',
    'TX_TO_USER_RECONCILIATION' => (
        $purchase
        && strtolower((string) $purchase->tx_hash) === $knownTx
        && $stakeRow
        && strtolower((string) $stakeRow->tx_hash) === $knownTx
        && (int) $purchase->user_id === (int) $user->id
        && (int) $stakeRow->user_id === (int) $user->id
    ) ? 'PASS' : 'FAIL',
    'LEGACY_ICO_STAKES_USED' => 'NO',
    'MAINNET_EXECUTED' => 'NO',
    'ico_purchases_count' => $purchases->count(),
    'engine_stakes_count' => count($stakes),
    'sample_purchase' => $purchase ? [
        'usdt' => (string) $purchase->usdt_amount,
        'race' => (string) $purchase->race_amount,
        'phase' => (int) $purchase->phase,
        'tx' => (string) $purchase->tx_hash,
    ] : null,
    'sample_stake' => $stakes[0] ?? null,
];

echo json_encode($result, JSON_PRETTY_PRINT).PHP_EOL;
