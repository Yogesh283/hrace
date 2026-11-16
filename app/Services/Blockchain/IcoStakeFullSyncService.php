<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEngineStake;
use App\Models\IcoPurchase;
use App\Models\SiteSetting;
use App\Models\User;

/**
 * Sync RaceICO createStake results into blockchain_engine_stakes (+ mark ico_purchases staked/held).
 * Source of truth remains on-chain; this is a Laravel read-model.
 */
final class IcoStakeFullSyncService
{
    private const LOCK_180 = 180 * 86400;

    private const LOCK_365 = 365 * 86400;

    private const LOCK_730 = 730 * 86400;

    private const LOCK_1095 = 1095 * 86400;

    /**
     * @return array{
     *     ico_completed: bool,
     *     on_chain_purchases: int,
     *     staked: int,
     *     held: int,
     *     stakes_upserted: int,
     *     purchases_marked: int,
     *     linked_users: int,
     *     engine_stake_rows: int
     * }
     */
    public function syncAll(): array
    {
        $rpc = BscJsonRpcClient::fromConfig();
        $ico = $this->raceIcoAddress();
        if ($ico === '') {
            throw new \RuntimeException('RaceICO address is not configured.');
        }

        $engine = $this->stakingEngineAddress($rpc, $ico);
        if ($engine === '') {
            $engine = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));
        }
        if ($engine === '') {
            throw new \RuntimeException('Community Engine / stakingEngine address is not configured.');
        }

        $icoCompletedHex = $rpc->call('eth_call', [['to' => $ico, 'data' => '0x204e8b17'], 'latest']);
        $icoCompleted = $this->hexToDec(is_string($icoCompletedHex) ? $icoCompletedHex : '0x0') !== '0';

        $countHex = $rpc->call('eth_call', [['to' => $ico, 'data' => '0x2b85ed9c'], 'latest']);
        $onChainCount = (int) $this->hexToDec(is_string($countHex) ? $countHex : '0x0');

        $staked = 0;
        $held = 0;
        $stakesUpserted = 0;
        $purchasesMarked = 0;
        $linkedUsers = 0;

        for ($purchaseId = 0; $purchaseId < $onChainCount; $purchaseId++) {
            $status = $this->readStakeStatus($rpc, $ico, $purchaseId);
            $purchase = $this->readPurchase($rpc, $ico, $purchaseId);
            if ($purchase === null || $status === null) {
                continue;
            }

            $userId = User::idByWallet($purchase['wallet_address']);
            if ($userId !== null) {
                $linkedUsers++;
            }

            if ($status['staked']) {
                $staked++;
                $lockSeconds = $purchase['lock_period'];
                $unlockAt = $purchase['unlock_at'];
                $startedAt = ($unlockAt > 0 && $lockSeconds > 0) ? max(0, $unlockAt - $lockSeconds) : 0;
                $principal = $status['principal_usdt'] !== '0'
                    ? $status['principal_usdt']
                    : $purchase['usdt_amount'];

                $engineStake = BlockchainEngineStake::query()->updateOrCreate(
                    [
                        'wallet_address' => $purchase['wallet_address'],
                        'stake_index' => $status['stake_index'],
                        'contract_address' => $engine,
                    ],
                    [
                        'user_id' => $userId,
                        'ico_purchase_id' => $purchaseId,
                        'principal_usdt' => $principal,
                        'staked_race' => $purchase['race_amount'],
                        'lock_seconds' => $lockSeconds,
                        'daily_rate_bps' => $this->dailyRateBps($lockSeconds),
                        'started_at' => $startedAt,
                        'unlock_at' => $unlockAt,
                        'source_type' => BlockchainEngineStake::SOURCE_ICO,
                        'withdrawn' => false,
                        'status' => BlockchainEngineStake::STATUS_ACTIVE,
                        'tx_hash' => $this->keepOrPlaceholderTx($purchaseId),
                    ],
                );
                $stakesUpserted++;

                $purchasesMarked += $this->markPurchase($purchaseId, $purchase, $userId, 'staked');

                if ($userId !== null) {
                    $user = User::query()->find($userId);
                    $user?->activateIdAndLockWithdrawalsAfterStake();
                    try {
                        app(IcoStakeInvestmentCreditor::class)->creditFromEngineStake($engineStake->fresh() ?? $engineStake);
                    } catch (\Throwable) {
                        // Backfill cron will retry.
                    }
                }
            } else {
                $held++;
                $purchasesMarked += $this->markPurchase($purchaseId, $purchase, $userId, 'held');
            }
        }

        return [
            'ico_completed' => $icoCompleted,
            'on_chain_purchases' => $onChainCount,
            'staked' => $staked,
            'held' => $held,
            'stakes_upserted' => $stakesUpserted,
            'purchases_marked' => $purchasesMarked,
            'linked_users' => $linkedUsers,
            'engine_stake_rows' => (int) BlockchainEngineStake::query()
                ->where('source_type', BlockchainEngineStake::SOURCE_ICO)
                ->count(),
        ];
    }

    private function raceIcoAddress(): string
    {
        try {
            $addr = strtolower(trim(SiteSetting::raceIcoContractAddress()));
            if ($addr !== '') {
                return $addr;
            }
        } catch (\Throwable) {
            // fall through
        }

        return strtolower(trim((string) config('blockchain.contracts.ico', '')));
    }

    private function stakingEngineAddress(BscJsonRpcClient $rpc, string $ico): string
    {
        $hex = $rpc->call('eth_call', [['to' => $ico, 'data' => '0xa0e38f4e'], 'latest']);
        if (! is_string($hex) || strlen($hex) < 42) {
            return '';
        }
        $raw = strtolower(preg_replace('/^0x/', '', $hex) ?? '');

        return '0x'.substr($raw, -40);
    }

    /**
     * @return array{staked: bool, stake_index: int, principal_usdt: string}|null
     */
    private function readStakeStatus(BscJsonRpcClient $rpc, string $ico, int $purchaseId): ?array
    {
        $data = '0x7c427faf'.str_pad(dechex($purchaseId), 64, '0', STR_PAD_LEFT);
        $hex = $rpc->call('eth_call', [['to' => $ico, 'data' => $data], 'latest']);
        if (! is_string($hex) || $hex === '' || $hex === '0x') {
            return null;
        }
        $raw = strtolower(preg_replace('/^0x/', '', $hex) ?? '');
        $raw = str_pad($raw, 192, '0', STR_PAD_RIGHT);

        return [
            'staked' => $this->hexToDec(substr($raw, 0, 64)) !== '0',
            'stake_index' => (int) $this->hexToDec(substr($raw, 64, 64)),
            'principal_usdt' => $this->weiToToken($this->hexToDec(substr($raw, 128, 64))),
        ];
    }

    /**
     * @return array{
     *     wallet_address: string,
     *     phase: int,
     *     race_amount: string,
     *     usdt_amount: string,
     *     price: string,
     *     unlock_at: int,
     *     lock_period: int
     * }|null
     */
    private function readPurchase(BscJsonRpcClient $rpc, string $ico, int $purchaseId): ?array
    {
        $data = '0x3742a9f7'.str_pad(dechex($purchaseId), 64, '0', STR_PAD_LEFT);
        $hex = $rpc->call('eth_call', [['to' => $ico, 'data' => $data], 'latest']);
        if (! is_string($hex) || $hex === '' || $hex === '0x') {
            return null;
        }
        $raw = strtolower(preg_replace('/^0x/', '', $hex) ?? '');
        $raw = str_pad($raw, 704, '0', STR_PAD_RIGHT);
        $buyer = '0x'.substr($raw, 24, 40);
        if (! preg_match('/^0x[a-f0-9]{40}$/', $buyer)) {
            return null;
        }

        return [
            'wallet_address' => $buyer,
            'phase' => (int) $this->hexToDec(substr($raw, 64, 64)),
            'race_amount' => $this->weiToToken($this->hexToDec(substr($raw, 128, 64))),
            'usdt_amount' => $this->weiToToken($this->hexToDec(substr($raw, 192, 64))),
            'price' => $this->weiToToken($this->hexToDec(substr($raw, 256, 64))),
            'unlock_at' => (int) $this->hexToDec(substr($raw, 384, 64)),
            'lock_period' => (int) $this->hexToDec(substr($raw, 576, 64)),
        ];
    }

    /**
     * @param  array{wallet_address: string, phase: int, usdt_amount: string, race_amount: string, price: string}  $purchase
     */
    private function markPurchase(int $purchaseId, array $purchase, ?int $userId, string $status): int
    {
        $row = IcoPurchase::query()->where('purchase_id', $purchaseId)->first();
        if (! $row) {
            return 0;
        }
        $row->fill([
            'user_id' => $userId ?? $row->user_id,
            'wallet_address' => $purchase['wallet_address'],
            'phase' => $purchase['phase'],
            'usdt_amount' => $purchase['usdt_amount'],
            'race_amount' => $purchase['race_amount'],
            'price' => $purchase['price'],
            'status' => $status,
        ]);
        if ($row->isDirty()) {
            $row->save();

            return 1;
        }

        return 0;
    }

    private function keepOrPlaceholderTx(int $purchaseId): string
    {
        $existing = BlockchainEngineStake::query()
            ->where('ico_purchase_id', $purchaseId)
            ->value('tx_hash');
        if (is_string($existing) && preg_match('/^0x[a-f0-9]{64}$/i', $existing) && ! str_starts_with(strtolower($existing), '0x000000000000000000000000000000000000000000000000000000000')) {
            return strtolower($existing);
        }

        return '0x'.str_pad(dechex($purchaseId), 64, '0', STR_PAD_LEFT);
    }

    private function dailyRateBps(int $lockSeconds): int
    {
        return match ($lockSeconds) {
            0 => 35,
            self::LOCK_180 => 50,
            self::LOCK_365 => 70,
            self::LOCK_730 => 90,
            self::LOCK_1095 => 100,
            default => 0,
        };
    }

    private function hexToDec(string $hex): string
    {
        $hex = strtolower(preg_replace('/^0x/', '', $hex) ?? '0');
        $hex = ltrim($hex, '0');
        if ($hex === '') {
            return '0';
        }
        if (! function_exists('gmp_init')) {
            return (string) hexdec($hex);
        }

        return gmp_strval(gmp_init($hex, 16), 10);
    }

    private function weiToToken(string $wei): string
    {
        if (! function_exists('bcdiv')) {
            return number_format(((float) $wei) / 1e18, 18, '.', '');
        }

        return bcdiv($wei, '1000000000000000000', 18);
    }
}
