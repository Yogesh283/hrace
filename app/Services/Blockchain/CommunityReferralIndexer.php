<?php

namespace App\Services\Blockchain;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Read-model: mirrors on-chain CommunityReferralPaid (instant level income) into income_wallet_transactions.
 * Does not mint RACE — settlement already happened in the stake tx via RewardVault.
 */
class CommunityReferralIndexer
{
    public function __construct(
        private readonly BlockchainWalletIndexerSyncService $walletSync,
    ) {}

    /**
     * @param  list<string>  $topics
     */
    public function ingestFromLog(
        array $topics,
        string $data,
        string $txHash,
        int $blockNumber,
        int $logIndex,
    ): void {
        if (! config('blockchain.community_referral_mirror.enabled', true)) {
            return;
        }

        if (! Schema::hasTable('income_wallet_transactions')) {
            return;
        }

        $sponsor = isset($topics[1]) ? '0x'.substr(strtolower((string) $topics[1]), 26) : '';
        $from = isset($topics[2]) ? '0x'.substr(strtolower((string) $topics[2]), 26) : '';
        if ($sponsor === '' || $from === '') {
            return;
        }

        $fields = $this->decodeDataFields($data);
        if ($fields === null) {
            return;
        }

        $sponsorLower = strtolower($sponsor);
        $userId = $this->walletSync->resolveUserIdForWallet($sponsorLower);
        if ($userId === null) {
            $userId = User::query()->whereRaw('LOWER(wallet_address) = ?', [$sponsorLower])->value('id');
        }

        $usdtAmount = $this->weiToToken($fields['usdt_value_wei']);
        $raceAmount = $this->weiToToken($fields['race_paid_wei']);
        $level = (int) $fields['level'];

        $idempotency = 'onchain:community_referral:'.strtolower($txHash).':'.$logIndex;

        IncomeWalletTransaction::query()->updateOrCreate(
            ['idempotency_key' => $idempotency],
            [
                'user_id' => $userId,
                'wallet_address' => $sponsorLower,
                'type' => IncomeWalletTransaction::TYPE_LEVEL_INCOME,
                'source_reference' => 'ico_stake_tx:'.strtolower($txHash),
                'amount' => $usdtAmount,
                'asset' => 'RACE',
                'direction' => IncomeWalletTransaction::DIRECTION_CREDIT,
                'status' => IncomeWalletTransaction::STATUS_POSTED,
                'metadata' => [
                    'on_chain_race_settlement' => true,
                    'race_amount' => $raceAmount,
                    'usdt_notional' => $usdtAmount,
                    'level' => $level,
                    'from_wallet' => strtolower($from),
                    'tx_hash' => strtolower($txHash),
                    'block_number' => $blockNumber,
                    'log_index' => $logIndex,
                ],
            ],
        );

        Log::debug('CommunityReferralIndexer mirrored level income', [
            'sponsor' => $sponsorLower,
            'tx' => $txHash,
            'level' => $level,
        ]);
    }

    public function backfillFromBlockchainEvents(): int
    {
        if (! Schema::hasTable('blockchain_events')) {
            return 0;
        }

        $count = 0;
        \App\Models\BlockchainEvent::query()
            ->where('event_name', 'CommunityReferralPaid')
            ->orderBy('id')
            ->each(function (\App\Models\BlockchainEvent $row) use (&$count) {
                $payload = $row->payload ?? [];
                $topics = $payload['topics'] ?? [];
                if (! is_array($topics) || $topics === []) {
                    return;
                }
                $before = IncomeWalletTransaction::query()
                    ->where('idempotency_key', 'onchain:community_referral:'.strtolower((string) $row->tx_hash).':'.$row->log_index)
                    ->exists();
                $this->ingestFromLog(
                    $topics,
                    (string) ($payload['data'] ?? '0x'),
                    (string) $row->tx_hash,
                    (int) $row->block_number,
                    (int) $row->log_index,
                );
                $after = IncomeWalletTransaction::query()
                    ->where('idempotency_key', 'onchain:community_referral:'.strtolower((string) $row->tx_hash).':'.$row->log_index)
                    ->exists();
                if (! $before && $after) {
                    $count++;
                }
            });

        return $count;
    }

    /**
     * @return array{level: int, usdt_value_wei: string, race_paid_wei: string}|null
     */
    private function decodeDataFields(string $data): ?array
    {
        $hex = Str::lower(Str::startsWith($data, '0x') ? substr($data, 2) : $data);
        if (strlen($hex) < 192) {
            return null;
        }

        return [
            'level' => (int) hexdec(substr($hex, 0, 64)),
            'usdt_value_wei' => $this->hexToDecimalString(substr($hex, 64, 64)),
            'race_paid_wei' => $this->hexToDecimalString(substr($hex, 128, 64)),
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
            return number_format(((float) $wei) / 1e18, 4, '.', '');
        }

        return bcdiv($wei, '1000000000000000000', 4);
    }
}
