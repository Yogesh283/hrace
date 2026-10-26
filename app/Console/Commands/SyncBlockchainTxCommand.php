<?php

namespace App\Console\Commands;

use App\Services\Blockchain\BlockchainEventIngestService;
use Illuminate\Console\Command;

class SyncBlockchainTxCommand extends Command
{
    protected $signature = 'blockchain:sync-tx {hash* : 0x transaction hash}';

    protected $description = 'Index one or more confirmed txs into blockchain_events / ico_purchases.';

    public function handle(BlockchainEventIngestService $ingest): int
    {
        $failed = 0;
        foreach ($this->argument('hash') as $hash) {
            $result = $ingest->ingestFromTxHash($hash);
            if (! ($result['ok'] ?? false)) {
                $this->error($hash.' '.($result['reason'] ?? 'failed'));
                $failed++;
                continue;
            }
            $this->info($hash.' events='.$result['events_indexed'].' '.implode(',', $result['event_names'] ?? []));
        }

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
