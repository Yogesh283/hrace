<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEvent;
use App\Models\IcoPurchase;
use App\Models\SiteSetting;
use App\Models\User;

/**
 * Full rebuild of ico_purchases from RaceICO.getPurchase(0..n-1).
 * Links user_id via users.wallet_address. Read-model only.
 *
 * Real tx_hash / block_number come from:
 * 1) blockchain_events (ICOPurchased / ICOPurchase) — preferred, no RPC range risk
 * 2) eth_getLogs fallback (chunked; failures skip that chunk instead of aborting all)
 */
final class IcoPurchaseFullSyncService
{
    public const ICO_PURCHASED_TOPIC = IcoPurchaseCatchUpService::ICO_PURCHASED_TOPIC;

    /**
     * @return array{
     *     on_chain_count: int,
     *     inserted: int,
     *     updated: int,
     *     linked_users: int,
     *     without_user: int,
     *     rows: int,
     *     tx_hashes_filled: int,
     *     filled_from_events: int,
     *     filled_from_logs: int,
     *     log_chunks_failed: int,
     *     placeholders_remaining: int,
     *     status_normalized: int
     * }
     */
    public function syncAll(int $logLookbackBlocks = 2_000_000): array
    {
        $rpc = BscJsonRpcClient::fromConfig();
        $ico = $this->raceIcoAddress();
        if ($ico === '') {
            throw new \RuntimeException('RaceICO address is not configured.');
        }

        $countHex = $rpc->call('eth_call', [[
            'to' => $ico,
            'data' => '0x2b85ed9c', // purchaseCount()
        ], 'latest']);
        $onChainCount = (int) $this->hexToDec(is_string($countHex) ? $countHex : '0x0');

        $inserted = 0;
        $updated = 0;
        $linkedUsers = 0;
        $withoutUser = 0;

        for ($purchaseId = 0; $purchaseId < $onChainCount; $purchaseId++) {
            $row = $this->readPurchase($rpc, $ico, $purchaseId);
            if ($row === null) {
                continue;
            }

            $userId = User::idByWallet($row['wallet_address']);
            if ($userId !== null) {
                $linkedUsers++;
            } else {
                $withoutUser++;
            }

            $existing = IcoPurchase::query()->where('purchase_id', $purchaseId)->first();
            // Buy = held until createStake → staked. Never leave new rows as "confirmed".
            $status = ($existing?->status === 'staked') ? 'staked' : 'held';
            $payload = [
                'user_id' => $userId,
                'wallet_address' => $row['wallet_address'],
                'phase' => $row['phase'],
                'usdt_amount' => $row['usdt_amount'],
                'race_amount' => $row['race_amount'],
                'price' => $row['price'],
                'status' => $status,
            ];

            if ($existing) {
                $existing->fill($payload);
                if ($existing->isDirty()) {
                    $existing->save();
                    $updated++;
                }
            } else {
                IcoPurchase::query()->create([
                    'purchase_id' => $purchaseId,
                    'tx_hash' => $this->placeholderTxHash($purchaseId),
                    'block_number' => null,
                    ...$payload,
                ]);
                $inserted++;
            }
        }

        $fromEvents = $this->fillTxHashesFromBlockchainEvents();
        $fromLogs = $this->fillTxHashesFromLogs($rpc, $ico, $logLookbackBlocks);
        $statusNormalized = $this->normalizeConfirmedToHeld();

        $placeholders = (int) IcoPurchase::query()
            ->where(function ($q) {
                $q->where('tx_hash', 'like', '0x000000%')
                    ->orWhereNull('block_number');
            })
            ->count();

        return [
            'on_chain_count' => $onChainCount,
            'inserted' => $inserted,
            'updated' => $updated,
            'linked_users' => $linkedUsers,
            'without_user' => $withoutUser,
            'rows' => (int) IcoPurchase::query()->count(),
            'tx_hashes_filled' => $fromEvents + $fromLogs['filled'],
            'filled_from_events' => $fromEvents,
            'filled_from_logs' => $fromLogs['filled'],
            'log_chunks_failed' => $fromLogs['chunks_failed'],
            'placeholders_remaining' => $placeholders,
            'status_normalized' => $statusNormalized,
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

    /**
     * @return array{wallet_address: string, phase: int, usdt_amount: string, race_amount: string, price: string}|null
     */
    private function readPurchase(BscJsonRpcClient $rpc, string $ico, int $purchaseId): ?array
    {
        // getPurchase(uint256) → buyer, phaseId, raceAmount, usdtPaid, priceUsdt, ...
        $data = '0x3742a9f7'.str_pad(dechex($purchaseId), 64, '0', STR_PAD_LEFT);
        $hex = $rpc->call('eth_call', [['to' => $ico, 'data' => $data], 'latest']);
        if (! is_string($hex) || $hex === '' || $hex === '0x') {
            return null;
        }

        $raw = strtolower(preg_replace('/^0x/', '', $hex) ?? '');
        $raw = str_pad($raw, 704, '0', STR_PAD_RIGHT);

        $buyer = '0x'.substr($raw, 24, 40);
        if (! preg_match('/^0x[a-f0-9]{40}$/', $buyer) || $buyer === '0x0000000000000000000000000000000000000000') {
            return null;
        }

        return [
            'wallet_address' => $buyer,
            'phase' => (int) $this->hexToDec(substr($raw, 64, 64)),
            'race_amount' => $this->weiToToken($this->hexToDecimalString(substr($raw, 128, 64))),
            'usdt_amount' => $this->weiToToken($this->hexToDecimalString(substr($raw, 192, 64))),
            'price' => $this->weiToToken($this->hexToDecimalString(substr($raw, 256, 64))),
        ];
    }

    /**
     * Prefer indexed events already in DB (no eth_getLogs range risk).
     */
    private function fillTxHashesFromBlockchainEvents(): int
    {
        $events = BlockchainEvent::query()
            ->whereIn('event_name', ['ICOPurchased', 'ICOPurchase'])
            ->orderBy('block_number')
            ->orderBy('log_index')
            ->get(['event_name', 'tx_hash', 'block_number', 'payload']);

        $filled = 0;
        foreach ($events as $event) {
            $topics = is_array($event->payload) ? ($event->payload['topics'] ?? []) : [];
            if (! is_array($topics) || count($topics) < 3) {
                continue;
            }

            $purchaseId = $this->purchaseIdFromTopics((string) $event->event_name, $topics);
            if ($purchaseId === null) {
                continue;
            }

            $tx = strtolower(trim((string) $event->tx_hash));
            if (! preg_match('/^0x[a-f0-9]{64}$/', $tx) || str_starts_with($tx, '0x000000')) {
                continue;
            }

            $blockNumber = $event->block_number !== null ? (int) $event->block_number : null;
            if ($this->applyTxFill($purchaseId, $tx, $blockNumber)) {
                $filled++;
            }
        }

        return $filled;
    }

    /**
     * @return array{filled: int, chunks_failed: int}
     */
    private function fillTxHashesFromLogs(BscJsonRpcClient $rpc, string $ico, int $lookbackBlocks): array
    {
        $latestHex = $rpc->call('eth_blockNumber', []);
        $latest = is_string($latestHex) ? (int) hexdec($latestHex) : 0;
        if ($latest <= 0) {
            return ['filled' => 0, 'chunks_failed' => 0];
        }

        // Skip RPC scan if nothing left to fill.
        $needsFill = IcoPurchase::query()
            ->where(function ($q) {
                $q->where('tx_hash', 'like', '0x000000%')
                    ->orWhereNull('block_number');
            })
            ->exists();
        if (! $needsFill) {
            return ['filled' => 0, 'chunks_failed' => 0];
        }

        $from = max(0, $latest - max(1_000, $lookbackBlocks));
        $chunkSize = 2_000;
        $filled = 0;
        $chunksFailed = 0;

        for ($start = $from; $start <= $latest; $start += $chunkSize) {
            $end = min($start + $chunkSize - 1, $latest);
            $logs = $rpc->getLogs($ico, $start, $end, $chunkSize, [self::ICO_PURCHASED_TOPIC]);
            if (! is_array($logs)) {
                $chunksFailed++;

                continue;
            }

            foreach ($logs as $log) {
                if (! is_array($log)) {
                    continue;
                }
                $tx = strtolower((string) ($log['transactionHash'] ?? ''));
                $topics = $log['topics'] ?? [];
                if ($tx === '' || ! is_array($topics) || count($topics) < 3) {
                    continue;
                }

                $purchaseId = isset($topics[1]) ? (int) hexdec((string) $topics[1]) : null;
                if ($purchaseId === null || $purchaseId < 0) {
                    continue;
                }

                $blockNumber = isset($log['blockNumber']) ? (int) hexdec((string) $log['blockNumber']) : null;
                if ($this->applyTxFill($purchaseId, $tx, $blockNumber)) {
                    $filled++;
                }
            }
        }

        return ['filled' => $filled, 'chunks_failed' => $chunksFailed];
    }

    /**
     * @param  list<string>  $topics
     */
    private function purchaseIdFromTopics(string $eventName, array $topics): ?int
    {
        if ($eventName === 'ICOPurchased' && isset($topics[1])) {
            return (int) hexdec((string) $topics[1]);
        }
        if ($eventName === 'ICOPurchase' && isset($topics[2])) {
            return (int) hexdec((string) $topics[2]);
        }

        return null;
    }

    private function applyTxFill(int $purchaseId, string $tx, ?int $blockNumber): bool
    {
        $row = IcoPurchase::query()->where('purchase_id', $purchaseId)->first();
        if (! $row) {
            return false;
        }

        $needsTx = $this->rowNeedsRealTx($row, $purchaseId);
        $needsBlock = $blockNumber !== null && ! $row->block_number;

        if (! $needsTx && ! $needsBlock) {
            return false;
        }

        // Avoid unique(tx_hash, purchase_id) clash if a real row already exists.
        if ($needsTx) {
            $clash = IcoPurchase::query()
                ->where('tx_hash', $tx)
                ->where('purchase_id', $purchaseId)
                ->where('id', '!=', $row->id)
                ->exists();
            if ($clash) {
                // Prefer the real row; drop this placeholder duplicate.
                $row->delete();

                return true;
            }
            $row->tx_hash = $tx;
        }

        if ($needsBlock) {
            $row->block_number = $blockNumber;
        }

        if ($row->status === 'confirmed') {
            $row->status = 'held';
        }

        $row->save();

        return true;
    }

    private function rowNeedsRealTx(IcoPurchase $row, int $purchaseId): bool
    {
        $tx = strtolower((string) $row->tx_hash);
        if ($tx === '') {
            return true;
        }
        if (str_starts_with($tx, '0x000000')) {
            return true;
        }

        return $this->isPlaceholderTx($tx, $purchaseId);
    }

    private function normalizeConfirmedToHeld(): int
    {
        return (int) IcoPurchase::query()
            ->where('status', 'confirmed')
            ->update(['status' => 'held']);
    }

    private function placeholderTxHash(int $purchaseId): string
    {
        return '0x'.str_pad(dechex($purchaseId), 64, '0', STR_PAD_LEFT);
    }

    private function isPlaceholderTx(string $txHash, int $purchaseId): bool
    {
        return strtolower($txHash) === $this->placeholderTxHash($purchaseId);
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

    private function hexToDecimalString(string $hex): string
    {
        return $this->hexToDec($hex);
    }

    private function weiToToken(string $wei): string
    {
        if (! function_exists('bcdiv')) {
            return (string) ((float) $wei / 1e18);
        }

        return bcdiv($wei, '1000000000000000000', 18);
    }
}
