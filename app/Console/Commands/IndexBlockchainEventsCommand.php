<?php

namespace App\Console\Commands;

use App\Services\Blockchain\BlockchainEventIngestService;
use App\Services\Blockchain\BscJsonRpcClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Read-only indexer: stores on-chain events for dashboards. Never calculates rewards.
 */
class IndexBlockchainEventsCommand extends Command
{
    protected $signature = 'blockchain:index-events {--dry-run : Report RPC/contracts/blocks without writing DB}';

    protected $description = 'Index Race Community Rewards contract events (read-only).';

    public function handle(BlockchainEventIngestService $ingest): int
    {
        if (! config('blockchain.indexer.enabled')) {
            $this->info('Blockchain indexer disabled.');

            return self::SUCCESS;
        }

        $chainId = (int) config('blockchain.chain_id');
        $rpcClient = BscJsonRpcClient::fromConfig();
        $this->info('Indexer network='.config('blockchain.network').' chain_id='.$chainId);

        foreach ($rpcClient->rpcUrls() as $index => $url) {
            $label = $index === 0 ? 'primary' : 'fallback_'.$index;
            $this->line("RPC {$label}: ".$rpcClient->redactUrl($url));
        }

        $liveChain = $rpcClient->assertExpectedChain();
        if ($liveChain === null) {
            $this->error("STOP: RPC eth_chainId failed or live chainId != configured {$chainId}");

            return self::FAILURE;
        }
        if ($chainId === 56 && filter_var(env('CONFIRM_TESTNET_DEPLOYMENT'), FILTER_VALIDATE_BOOL)) {
            $this->error('STOP: refusing Mainnet index while CONFIRM_TESTNET_DEPLOYMENT is set');

            return self::FAILURE;
        }
        if ($chainId === 97) {
            $this->info('PASS: Testnet chain 97 confirmed on RPC');
        }

        $contracts = array_keys($ingest->allowedContracts());

        if ($contracts === []) {
            $this->warn('No contract addresses configured. Set RACE_*_CONTRACT in .env.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $latest = $rpcClient->call('eth_blockNumber', []);
            $latestBlock = is_string($latest) ? hexdec($latest) : 0;
            $this->info('DRY-RUN: latest block '.$latestBlock);
            $this->info('DRY-RUN: start_block '.config('blockchain.indexer.start_block'));
            $this->info('DRY-RUN: batch_size '.config('blockchain.indexer.batch_size'));
            $this->info('DRY-RUN: log_chunk_size '.config('blockchain.indexer.log_chunk_size'));
            $this->info('DRY-RUN: rpc_retries '.config('blockchain.indexer.rpc_retries'));
            foreach ($contracts as $address) {
                $this->info('DRY-RUN contract: '.$address);
            }
            $this->info('DRY-RUN complete — no DB writes, no transactions.');

            return self::SUCCESS;
        }

        $failed = false;
        foreach ($contracts as $address) {
            if (! $this->indexContract($rpcClient, $ingest, $address)) {
                $failed = true;
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    private function indexContract(BscJsonRpcClient $rpcClient, BlockchainEventIngestService $ingest, string $contract): bool
    {
        $state = DB::table('blockchain_index_state')
            ->where('contract_address', $contract)
            ->first();

        $fromBlock = $state
            ? (int) $state->last_indexed_block + 1
            : (int) config('blockchain.indexer.start_block', 0);

        $latest = $rpcClient->call('eth_blockNumber', []);
        if (! is_string($latest)) {
            $this->error('RPC eth_blockNumber failed.');

            return false;
        }

        $latestBlock = hexdec($latest);
        $batch = (int) config('blockchain.indexer.batch_size', 2000);
        $toBlock = min($fromBlock + $batch - 1, $latestBlock);

        if ($fromBlock > $toBlock) {
            $this->info("Up to date {$contract} (last indexed >= latest).");

            return true;
        }

        $chunkSize = (int) config('blockchain.indexer.log_chunk_size', 250);
        $logs = $rpcClient->getLogs($contract, $fromBlock, $toBlock, $chunkSize);

        if ($logs === null) {
            $this->error("eth_getLogs failed for {$contract} blocks {$fromBlock}–{$toBlock} (chunk={$chunkSize})");

            return false;
        }

        foreach ($logs as $log) {
            $ingest->storeLog($contract, $log);
        }

        DB::table('blockchain_index_state')->updateOrInsert(
            ['contract_address' => $contract],
            ['last_indexed_block' => $toBlock, 'updated_at' => now(), 'created_at' => now()],
        );

        $this->info("Indexed {$contract} blocks {$fromBlock}–{$toBlock} (".count($logs).' logs).');

        return true;
    }
}
