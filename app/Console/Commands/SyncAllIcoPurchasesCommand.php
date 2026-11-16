<?php

namespace App\Console\Commands;

use App\Models\IcoPurchase;
use App\Services\Blockchain\IcoPurchaseFullSyncService;
use Illuminate\Console\Command;

class SyncAllIcoPurchasesCommand extends Command
{
    protected $signature = 'blockchain:sync-all-ico-purchases
        {--blocks=2000000 : Lookback blocks when filling real tx hashes from logs (fallback)}';

    protected $description = 'Import every RaceICO getPurchase() row into ico_purchases with user_id from wallet_address';

    public function handle(IcoPurchaseFullSyncService $sync): int
    {
        $this->info('Syncing all on-chain ICO purchases into ico_purchases…');

        try {
            $result = $sync->syncAll((int) $this->option('blocks'));
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info(
            'on_chain='.$result['on_chain_count']
            .' inserted='.$result['inserted']
            .' updated='.$result['updated']
            .' linked_users='.$result['linked_users']
            .' without_user='.$result['without_user']
            .' tx_hashes_filled='.$result['tx_hashes_filled']
            .' filled_from_events='.$result['filled_from_events']
            .' filled_from_logs='.$result['filled_from_logs']
            .' log_chunks_failed='.$result['log_chunks_failed']
            .' status_normalized='.$result['status_normalized']
            .' placeholders_remaining='.$result['placeholders_remaining']
            .' ico_purchases_rows='.$result['rows']
            .' usdt_sum='.IcoPurchase::query()->sum('usdt_amount')
            .' race_sum='.IcoPurchase::query()->sum('race_amount')
        );

        if ($result['placeholders_remaining'] > 0) {
            $this->warn(
                'Still '.$result['placeholders_remaining']
                .' rows missing real tx/block. Re-run with larger --blocks or index missing ICO txs into blockchain_events.'
            );
        }

        return self::SUCCESS;
    }
}
