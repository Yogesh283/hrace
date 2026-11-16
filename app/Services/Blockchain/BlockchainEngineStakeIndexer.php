<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEngineStake;
use App\Models\BlockchainEvent;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Parses CommunityEngine stake events into blockchain_engine_stakes read-model rows.
 */
class BlockchainEngineStakeIndexer
{
    public function __construct(
        private readonly BlockchainWalletIndexerSyncService $walletSync,
    ) {}

    /**
     * @param  list<string>  $topics
     */
    public function storeIcoStakeCreated(
        array $topics,
        string $data,
        string $txHash,
        int $blockNumber,
        string $contract,
        mixed $userId,
    ): void {
        if (! \Illuminate\Support\Facades\Schema::hasTable('blockchain_engine_stakes')) {
            return;
        }

        $wallet = isset($topics[1]) ? '0x'.substr((string) $topics[1], 26) : '';
        $stakeIndex = isset($topics[2]) ? hexdec((string) $topics[2]) : null;
        $icoPurchaseId = isset($topics[3]) ? hexdec((string) $topics[3]) : null;

        if ($wallet === '' || $stakeIndex === null || $txHash === '') {
            return;
        }

        $parsed = $this->parseStakeDataFields($data);
        if ($parsed === null) {
            return;
        }

        $walletLower = strtolower($wallet);
        $resolvedUserId = $userId ?? $this->walletSync->resolveUserIdForWallet($walletLower);

        BlockchainEngineStake::query()->updateOrCreate(
            [
                'wallet_address' => $walletLower,
                'stake_index' => (int) $stakeIndex,
                'contract_address' => strtolower($contract),
            ],
            [
                'user_id' => $resolvedUserId,
                'ico_purchase_id' => $icoPurchaseId,
                'principal_usdt' => $parsed['principal_usdt'],
                'staked_race' => $parsed['staked_race'],
                'lock_seconds' => $parsed['lock_seconds'],
                'daily_rate_bps' => $parsed['daily_rate_bps'],
                'unlock_at' => $parsed['unlock_at'],
                'started_at' => $parsed['started_at'],
                'source_type' => BlockchainEngineStake::SOURCE_ICO,
                'withdrawn' => false,
                'status' => BlockchainEngineStake::STATUS_ACTIVE,
                'tx_hash' => strtolower($txHash),
                'block_number' => $blockNumber,
            ],
        );

        // Any ICO createStake / openIcoStake: activate Member ID + 24h withdrawal lock.
        $this->activateUserAfterIcoStake($resolvedUserId);
        $this->creditInvestmentIfPossible($walletLower, (int) $stakeIndex, strtolower($contract));
    }

    /**
     * @param  list<string>  $topics
     */
    public function markStakeWithdrawn(array $topics, string $data, string $contract): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('blockchain_engine_stakes')) {
            return;
        }

        $wallet = isset($topics[1]) ? '0x'.substr((string) $topics[1], 26) : '';
        if ($wallet === '') {
            return;
        }

        $hex = Str::lower(Str::startsWith($data, '0x') ? substr($data, 2) : $data);
        if (strlen($hex) < 64) {
            return;
        }

        $stakeIndex = (int) hexdec(substr($hex, 0, 64));
        $walletLower = strtolower($wallet);

        BlockchainEngineStake::query()
            ->where('wallet_address', $walletLower)
            ->where('stake_index', $stakeIndex)
            ->where('contract_address', strtolower($contract))
            ->update([
                'withdrawn' => true,
                'status' => BlockchainEngineStake::STATUS_WITHDRAWN,
            ]);
    }

    /**
     * RaceICO createStake emits ICOHoldStakeCreated / RaceMintedToStaking (not only Engine ICOStakeCreated).
     *
     * @param  list<string>  $topics
     */
    public function storeFromIcoHoldOrMint(
        string $eventName,
        array $topics,
        string $data,
        string $txHash,
        int $blockNumber,
        mixed $userId,
    ): void {
        if (! \Illuminate\Support\Facades\Schema::hasTable('blockchain_engine_stakes')) {
            return;
        }

        $wallet = '';
        $icoPurchaseId = null;
        $stakeIndex = null;
        $principal = '0';
        $race = '0';
        $lockSeconds = 0;

        $hex = Str::lower(Str::startsWith($data, '0x') ? substr($data, 2) : $data);

        if ($eventName === 'ICOHoldStakeCreated') {
            // buyer[1], purchaseId[2]; data: principalUsdt, raceAmount, price, stakeIndex
            $wallet = isset($topics[1]) ? '0x'.substr((string) $topics[1], 26) : '';
            $icoPurchaseId = isset($topics[2]) ? hexdec((string) $topics[2]) : null;
            if (strlen($hex) >= 256) {
                $principal = $this->weiToToken($this->hexToDecimalString(substr($hex, 0, 64)));
                $race = $this->weiToToken($this->hexToDecimalString(substr($hex, 64, 64)));
                $stakeIndex = (int) hexdec(substr($hex, 192, 64));
            }
        } elseif ($eventName === 'RaceMintedToStaking') {
            // stakingEngine[1], buyer[2], purchaseId[3]; data: raceAmount, lockPeriod, stakeIndex
            $wallet = isset($topics[2]) ? '0x'.substr((string) $topics[2], 26) : '';
            $icoPurchaseId = isset($topics[3]) ? hexdec((string) $topics[3]) : null;
            if (strlen($hex) >= 192) {
                $race = $this->weiToToken($this->hexToDecimalString(substr($hex, 0, 64)));
                $lockSeconds = (int) hexdec(substr($hex, 64, 64));
                $stakeIndex = (int) hexdec(substr($hex, 128, 64));
            }
        }

        if ($wallet === '' || $stakeIndex === null || $txHash === '') {
            return;
        }

        $engine = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));
        if ($engine === '') {
            return;
        }

        $walletLower = strtolower($wallet);
        $resolvedUserId = $userId ?? $this->walletSync->resolveUserIdForWallet($walletLower);
        $unlockAt = $lockSeconds > 0 ? time() + $lockSeconds : 0;

        BlockchainEngineStake::query()->updateOrCreate(
            [
                'wallet_address' => $walletLower,
                'stake_index' => (int) $stakeIndex,
                'contract_address' => $engine,
            ],
            [
                'user_id' => $resolvedUserId,
                'ico_purchase_id' => $icoPurchaseId,
                'principal_usdt' => $principal,
                'staked_race' => $race,
                'lock_seconds' => $lockSeconds,
                'daily_rate_bps' => $this->dailyRateBps($lockSeconds),
                'unlock_at' => $unlockAt,
                'started_at' => $lockSeconds > 0 ? time() : 0,
                'source_type' => BlockchainEngineStake::SOURCE_ICO,
                'withdrawn' => false,
                'status' => BlockchainEngineStake::STATUS_ACTIVE,
                'tx_hash' => strtolower($txHash),
                'block_number' => $blockNumber,
            ],
        );

        $this->activateUserAfterIcoStake($resolvedUserId);
        $this->creditInvestmentIfPossible($walletLower, (int) $stakeIndex, $engine);
    }

    public function backfillFromBlockchainEvents(): int
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('blockchain_engine_stakes')) {
            return 0;
        }

        $count = 0;
        BlockchainEvent::query()
            ->whereIn('event_name', ['ICOStakeCreated', 'ICOHoldStakeCreated', 'RaceMintedToStaking'])
            ->orderBy('id')
            ->chunkById(100, function ($events) use (&$count) {
                foreach ($events as $event) {
                    $payload = is_array($event->payload) ? $event->payload : [];
                    $topics = $payload['topics'] ?? [];
                    if (! is_array($topics) || $topics === []) {
                        continue;
                    }

                    if ($event->event_name === 'ICOStakeCreated') {
                        $this->storeIcoStakeCreated(
                            $topics,
                            (string) ($payload['data'] ?? ''),
                            (string) $event->tx_hash,
                            (int) $event->block_number,
                            (string) $event->contract_address,
                            $event->user_id,
                        );
                    } else {
                        $this->storeFromIcoHoldOrMint(
                            (string) $event->event_name,
                            $topics,
                            (string) ($payload['data'] ?? ''),
                            (string) $event->tx_hash,
                            (int) $event->block_number,
                            $event->user_id,
                        );
                    }
                    $count++;
                }
            });

        return $count;
    }

    private function activateUserAfterIcoStake(mixed $userId): void
    {
        if ($userId === null || $userId === '' || (int) $userId <= 0) {
            return;
        }

        $user = User::query()->find((int) $userId);
        if ($user) {
            $user->activateIdAndLockWithdrawalsAfterStake();
        }
    }

    private function creditInvestmentIfPossible(string $wallet, int $stakeIndex, string $contract): void
    {
        try {
            app(IcoStakeInvestmentCreditor::class)->creditLatestForWalletStake($wallet, $stakeIndex, $contract);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Auto investment credit after ICO stake index failed', [
                'wallet' => $wallet,
                'stake_index' => $stakeIndex,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function dailyRateBps(int $lockSeconds): int
    {
        return match ($lockSeconds) {
            0 => 35,
            180 * 86400 => 50,
            365 * 86400 => 70,
            730 * 86400 => 90,
            1095 * 86400 => 100,
            default => 0,
        };
    }

    /**
     * @return array{principal_usdt: string, staked_race: string, lock_seconds: int, daily_rate_bps: int, unlock_at: int, started_at: int}|null
     */
    private function parseStakeDataFields(string $data): ?array
    {
        $hex = Str::lower(Str::startsWith($data, '0x') ? substr($data, 2) : $data);
        if (strlen($hex) < 320) {
            return null;
        }

        $usdtWei = $this->hexToDecimalString(substr($hex, 0, 64));
        $raceWei = $this->hexToDecimalString(substr($hex, 64, 64));
        $lockSeconds = (int) hexdec(substr($hex, 128, 64));
        $dailyRateBps = (int) hexdec(substr($hex, 192, 64));
        $unlockAt = (int) hexdec(substr($hex, 256, 64));
        $startedAt = $unlockAt > 0 && $lockSeconds > 0 ? max(0, $unlockAt - $lockSeconds) : 0;

        return [
            'principal_usdt' => $this->weiToToken($usdtWei),
            'staked_race' => $this->weiToToken($raceWei),
            'lock_seconds' => $lockSeconds,
            'daily_rate_bps' => $dailyRateBps,
            'unlock_at' => $unlockAt,
            'started_at' => $startedAt,
        ];
    }

    private function hexToDecimalString(string $hex64): string
    {
        $hex = ltrim($hex64, '0');
        if ($hex === '') {
            return '0';
        }

        return function_exists('gmp_init')
            ? gmp_strval(gmp_init($hex, 16), 10)
            : (string) hexdec($hex);
    }

    private function weiToToken(string $wei): string
    {
        if (! function_exists('bcdiv')) {
            return number_format(((float) $wei) / 1e18, 18, '.', '');
        }

        return bcdiv($wei, '1000000000000000000', 18);
    }
}
