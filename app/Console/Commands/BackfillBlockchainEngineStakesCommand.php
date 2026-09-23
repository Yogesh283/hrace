<?php

namespace App\Console\Commands;

use App\Services\Blockchain\BlockchainEngineStakeIndexer;
use App\Services\Blockchain\BlockchainWalletIndexerSyncService;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Backfill blockchain_engine_stakes from indexed ICOStakeCreated events (read-model only).
 */
class BackfillBlockchainEngineStakesCommand extends Command
{
    protected $signature = 'blockchain:backfill-engine-stakes {--sync-users : Link user_id on indexed rows by wallet_address}';

    protected $description = 'Backfill CommunityEngine stake read-model from blockchain_events (testnet indexer).';

    public function handle(BlockchainEngineStakeIndexer $indexer, BlockchainWalletIndexerSyncService $walletSync): int
    {
        $count = $indexer->backfillFromBlockchainEvents();
        $this->info("Backfilled/processed {$count} ICOStakeCreated event(s).");

        if ($this->option('sync-users')) {
            $linked = 0;
            User::query()
                ->whereNotNull('wallet_address')
                ->where('wallet_address', '!=', '')
                ->orderBy('id')
                ->each(function (User $user) use ($walletSync, &$linked) {
                    $walletSync->syncForUser($user);
                    $linked++;
                });
            $this->info("Synced wallet index for {$linked} user(s).");
        }

        return self::SUCCESS;
    }
}
