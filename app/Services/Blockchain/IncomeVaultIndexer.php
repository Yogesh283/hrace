<?php

namespace App\Services\Blockchain;

use App\Models\OnChainIncomeBalance;
use App\Models\OnChainIncomeLedgerEntry;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Applies RaceIncomeVault events into Laravel read-model tables.
 */
class IncomeVaultIndexer
{
    public function __construct(
        private readonly BlockchainWalletIndexerSyncService $walletSync,
    ) {}

    /**
     * @param  array<string, mixed>  $decoded
     */
    public function ingestEvent(
        string $eventName,
        array $decoded,
        string $txHash,
        int $blockNumber,
        int $logIndex,
        string $contractAddress,
        int $chainId = 0,
        ?string $blockHash = null,
        ?string $eventSignature = null,
    ): void {
        if (! config('income_vault.indexer.enabled')) {
            return;
        }

        $chainId = $chainId > 0 ? $chainId : (int) config('blockchain.chain_id', 56);
        $wallet = strtolower((string) ($decoded['user'] ?? $decoded['wallet'] ?? ''));
        if ($wallet === '') {
            return;
        }

        $userId = $this->walletSync->resolveUserIdForWallet($wallet);

        $entry = OnChainIncomeLedgerEntry::query()->updateOrCreate(
            [
                'chain_id' => $chainId,
                'tx_hash' => strtolower($txHash),
                'log_index' => $logIndex,
            ],
            [
                'user_id' => $userId,
                'wallet_address' => $wallet,
                'event_name' => $eventName,
                'event_signature' => $eventSignature,
                'income_type' => $decoded['incomeType'] ?? null,
                'reference_id' => $decoded['referenceId'] ?? null,
                'withdrawal_id' => $decoded['withdrawalId'] ?? null,
                'amount' => $decoded['amount'] ?? 0,
                'gross_amount' => $decoded['grossAmount'] ?? null,
                'team_reward' => $decoded['teamReward'] ?? null,
                'admin_fee' => $decoded['adminFee'] ?? null,
                'net_amount' => $decoded['netAmount'] ?? null,
                'block_number' => $blockNumber,
                'block_hash' => $blockHash ? strtolower($blockHash) : null,
                'contract_address' => strtolower($contractAddress),
                'legacy_migrated' => $eventName === 'IncomeMigrated',
                'raw' => $decoded,
            ],
        );

        $this->recomputeBalance($wallet, $userId);

        Log::debug('IncomeVaultIndexer ingested', ['id' => $entry->id, 'event' => $eventName]);
    }

    public function recomputeBalance(string $walletLower, mixed $userId): void
    {
        $credited = (float) OnChainIncomeLedgerEntry::query()
            ->where('wallet_address', $walletLower)
            ->whereIn('event_name', ['IncomeCredited', 'IncomeMigrated'])
            ->sum('amount');

        $withdrawn = (float) OnChainIncomeLedgerEntry::query()
            ->where('wallet_address', $walletLower)
            ->where('event_name', 'IncomeWithdrawal')
            ->sum('gross_amount');

        $balance = max(0, $credited - $withdrawn);

        OnChainIncomeBalance::query()->updateOrCreate(
            ['wallet_address' => $walletLower],
            [
                'user_id' => $userId,
                'balance_amount' => number_format($balance, 8, '.', ''),
                'total_credited' => number_format($credited, 8, '.', ''),
                'total_withdrawn_gross' => number_format($withdrawn, 8, '.', ''),
                'last_indexed_at' => now(),
            ],
        );
    }

    public function chainBalanceForWallet(string $walletLower): ?string
    {
        $contract = config('income_vault.contract_address');
        if ($contract === '') {
            return null;
        }

        try {
            $client = BscJsonRpcClient::fromConfig();
            $callData = '0xa0821be3'.str_pad(substr($walletLower, 2), 64, '0', STR_PAD_LEFT);
            $result = $client->call('eth_call', [
                ['to' => strtolower($contract), 'data' => $callData],
                'latest',
            ]);
            if (! is_string($result) || ! str_starts_with($result, '0x')) {
                return null;
            }

            $wei = gmp_strval(gmp_init(substr($result, 2), 16));

            return bcdiv($wei, bcpow('10', '18', 0), 8);
        } catch (\Throwable) {
            return null;
        }
    }
}
