<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEngineStake;
use App\Models\BlockchainEvent;
use App\Models\User;
use App\Support\RewardPlan;
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

        // ICO openIcoStake ($50+) must flip Member ID / participation on the Laravel user row.
        if ($resolvedUserId && RewardPlan::isQualifyingParticipationAmount((string) $parsed['principal_usdt'])) {
            $user = User::query()->find($resolvedUserId);
            if ($user) {
                $patch = [];
                if ($user->participation_activated_at === null) {
                    $patch['participation_activated_at'] = now();
                }
                if ($user->id_activated_at === null) {
                    $patch['id_activated_at'] = now();
                }
                if ($patch !== []) {
                    $user->forceFill($patch)->save();
                }
            }
        }
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

    public function backfillFromBlockchainEvents(): int
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('blockchain_engine_stakes')) {
            return 0;
        }

        $count = 0;
        BlockchainEvent::query()
            ->where('event_name', 'ICOStakeCreated')
            ->orderBy('id')
            ->chunkById(100, function ($events) use (&$count) {
                foreach ($events as $event) {
                    $payload = is_array($event->payload) ? $event->payload : [];
                    $topics = $payload['topics'] ?? [];
                    if (! is_array($topics) || $topics === []) {
                        continue;
                    }

                    $this->storeIcoStakeCreated(
                        $topics,
                        (string) ($payload['data'] ?? ''),
                        (string) $event->tx_hash,
                        (int) $event->block_number,
                        (string) $event->contract_address,
                        $event->user_id,
                    );
                    $count++;
                }
            });

        return $count;
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
