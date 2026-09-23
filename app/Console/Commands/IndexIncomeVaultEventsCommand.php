<?php

namespace App\Console\Commands;

use App\Services\Blockchain\BscJsonRpcClient;
use App\Services\Blockchain\IncomeVaultEventDecoder;
use App\Services\Blockchain\IncomeVaultIndexer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class IndexIncomeVaultEventsCommand extends Command
{
    protected $signature = 'income:index-vault {--repair : Recompute balances from indexed ledger only}';

    protected $description = 'Index RaceIncomeVault logs (confirmed depth) into on_chain_income_* read model.';

    public function handle(IncomeVaultEventDecoder $decoder, IncomeVaultIndexer $indexer): int
    {
        if ($this->option('repair')) {
            return $this->repair($indexer);
        }

        $contract = strtolower(trim((string) config('income_vault.contract_address')));
        if ($contract === '') {
            $this->error('RACE_INCOME_VAULT_CONTRACT not configured.');

            return self::FAILURE;
        }

        if (! config('income_vault.indexer.enabled')) {
            $this->warn('Income vault indexer disabled in config.');

            return self::SUCCESS;
        }

        $chainId = (int) config('blockchain.chain_id');
        if ($chainId === 56) {
            $this->error('STOP: mainnet indexing blocked for this command in decentralization track.');

            return self::FAILURE;
        }

        $rpc = BscJsonRpcClient::fromConfig();
        if ($rpc->assertExpectedChain() === null) {
            $this->error('RPC chain mismatch.');

            return self::FAILURE;
        }

        $confirmations = max(1, (int) config('blockchain.confirmations', 3));
        $latestHex = $rpc->call('eth_blockNumber', []);
        if (! is_string($latestHex)) {
            $this->error('eth_blockNumber failed');

            return self::FAILURE;
        }
        $safeHead = hexdec($latestHex) - $confirmations;

        $state = DB::table('blockchain_index_state')->where('contract_address', $contract)->first();
        $fromBlock = $state ? (int) $state->last_indexed_block + 1 : (int) config('blockchain.indexer.start_block', 0);
        $batch = (int) config('blockchain.indexer.batch_size', 2000);
        $toBlock = min($fromBlock + $batch - 1, max(0, $safeHead));

        if ($fromBlock > $toBlock) {
            $this->info("Vault indexer up to date (safe head {$safeHead}).");

            return self::SUCCESS;
        }

        $chunk = (int) config('blockchain.indexer.log_chunk_size', 250);
        $logs = $rpc->getLogs($contract, $fromBlock, $toBlock, $chunk);
        if ($logs === null) {
            $this->error('eth_getLogs failed');

            return self::FAILURE;
        }

        $indexed = 0;
        $blockHashes = [];
        foreach ($logs as $log) {
            $topic0 = $log['topics'][0] ?? null;
            $name = $decoder->resolveName(is_string($topic0) ? $topic0 : null);
            if ($name === null) {
                continue;
            }
            $txHash = strtolower((string) ($log['transactionHash'] ?? ''));
            $logIndex = hexdec((string) ($log['logIndex'] ?? '0x0'));
            $blockNumber = hexdec((string) ($log['blockNumber'] ?? '0x0'));
            if (! isset($blockHashes[$blockNumber])) {
                $blockHex = $rpc->call('eth_getBlockByNumber', ['0x'.dechex($blockNumber), false]);
                $blockHashes[$blockNumber] = is_array($blockHex) ? strtolower((string) ($blockHex['hash'] ?? '')) : null;
            }
            $decoded = $decoder->decode($name, $log['topics'] ?? [], (string) ($log['data'] ?? '0x'));
            if ($decoded === null) {
                continue;
            }
            $indexer->ingestEvent(
                $name,
                $decoded,
                $txHash,
                $blockNumber,
                $logIndex,
                $contract,
                $chainId,
                $blockHashes[$blockNumber],
                is_string($topic0) ? strtolower($topic0) : null,
            );
            $indexed++;
        }

        foreach ($blockHashes as $bn => $hash) {
            if ($hash) {
                DB::table('blockchain_vault_block_hashes')->updateOrInsert(
                    ['contract_address' => $contract, 'block_number' => $bn],
                    ['block_hash' => $hash, 'updated_at' => now(), 'created_at' => now()],
                );
            }
        }

        DB::table('blockchain_index_state')->updateOrInsert(
            ['contract_address' => $contract],
            ['last_indexed_block' => $toBlock, 'updated_at' => now(), 'created_at' => now()],
        );

        $this->info("Indexed vault {$contract} blocks {$fromBlock}-{$toBlock}, events={$indexed}, confirmations={$confirmations}");

        return self::SUCCESS;
    }

    private function repair(IncomeVaultIndexer $indexer): int
    {
        $wallets = DB::table('on_chain_income_ledger')->distinct()->pluck('wallet_address');
        foreach ($wallets as $wallet) {
            $indexer->recomputeBalance(strtolower((string) $wallet), null);
        }
        $this->info('Repaired '.$wallets->count().' wallet balances from ledger.');

        return self::SUCCESS;
    }
}
