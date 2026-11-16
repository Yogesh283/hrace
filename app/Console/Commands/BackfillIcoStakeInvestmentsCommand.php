<?php

namespace App\Console\Commands;

use App\Models\BlockchainEngineStake;
use App\Services\Blockchain\IcoStakeInvestmentCreditor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

/**
 * Create missing investments / fund ledger rows for already-indexed ICO engine stakes.
 */
class BackfillIcoStakeInvestmentsCommand extends Command
{
    protected $signature = 'blockchain:backfill-ico-stake-investments
        {--user= : Optional user id}';

    protected $description = 'Credit investments + fund transactions for ICO createStake rows missing from investments table';

    public function handle(IcoStakeInvestmentCreditor $creditor): int
    {
        if (! Schema::hasTable('blockchain_engine_stakes')) {
            $this->error('blockchain_engine_stakes missing');

            return self::FAILURE;
        }

        $q = BlockchainEngineStake::query()
            ->where('withdrawn', false)
            ->whereNotNull('user_id')
            ->orderBy('id');

        if ($this->option('user')) {
            $q->where('user_id', (int) $this->option('user'));
        }

        $created = 0;
        $skipped = 0;

        $q->chunkById(100, function ($rows) use (&$created, &$skipped, $creditor) {
            foreach ($rows as $stake) {
                if ($creditor->creditFromEngineStake($stake)) {
                    $created++;
                } else {
                    $skipped++;
                }
            }
        });

        $this->info("created={$created} skipped={$skipped}");

        return self::SUCCESS;
    }
}
