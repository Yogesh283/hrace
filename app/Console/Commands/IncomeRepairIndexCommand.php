<?php

namespace App\Console\Commands;

use App\Services\Blockchain\BscJsonRpcClient;
use App\Services\Blockchain\IncomeVaultIndexer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Detect reorg by comparing indexed block hashes; roll back vault index state for replay.
 */
class IncomeRepairIndexCommand extends Command
{
    protected $signature = 'income:repair-index {--blocks=20 : Blocks to rewind on mismatch}';

    protected $description = 'Reorg-safe repair: verify recent indexed blocks and rewind vault index cursor if RPC hash differs.';

    public function handle(BscJsonRpcClient $rpc, IncomeVaultIndexer $indexer): int
    {
        $contract = strtolower(trim((string) config('income_vault.contract_address')));
        if ($contract === '') {
            $this->error('RACE_INCOME_VAULT_CONTRACT not configured.');

            return self::FAILURE;
        }

        $state = DB::table('blockchain_index_state')->where('contract_address', $contract)->first();
        if (! $state) {
            $this->info('No index state — nothing to repair.');

            return self::SUCCESS;
        }

        $last = (int) $state->last_indexed_block;
        $rewind = max(1, (int) $this->option('blocks'));
        $checkBlock = max(0, $last - $rewind);

        $hashAt = $rpc->call('eth_getBlockByNumber', ['0x'.dechex($checkBlock), false]);
        if (! is_array($hashAt) || empty($hashAt['hash'])) {
            $this->warn('Could not fetch block hash for reorg check.');

            return self::SUCCESS;
        }

        $stored = DB::table('blockchain_vault_block_hashes')
            ->where('contract_address', $contract)
            ->where('block_number', $checkBlock)
            ->value('block_hash');

        if ($stored !== null && strtolower((string) $stored) !== strtolower((string) $hashAt['hash'])) {
            $newLast = max(0, $checkBlock - 1);
            DB::table('blockchain_index_state')
                ->where('contract_address', $contract)
                ->update(['last_indexed_block' => $newLast, 'updated_at' => now()]);
            DB::table('on_chain_income_ledger')
                ->where('contract_address', $contract)
                ->where('block_number', '>', $newLast)
                ->delete();
            $this->warn("Reorg detected at block {$checkBlock}. Rewound cursor to {$newLast}. Run income:index-vault.");
            $this->call('income:index-vault');

            return self::SUCCESS;
        }

        DB::table('blockchain_vault_block_hashes')->updateOrInsert(
            ['contract_address' => $contract, 'block_number' => $checkBlock],
            ['block_hash' => strtolower((string) $hashAt['hash']), 'updated_at' => now()],
        );

        $this->info("No reorg at block {$checkBlock}. Cursor last={$last}.");

        return self::SUCCESS;
    }
}
