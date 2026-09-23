<?php

namespace App\Console\Commands;

use App\Services\Income\StakeUnlockService;
use Illuminate\Console\Command;

class IncomeReleaseStakeEmisCommand extends Command
{
    protected $signature = 'income:release-stake-emis {--limit=500 : Max EMIs to process}';

    protected $description = 'Credit due stake-unlock EMIs (30% × 3) to member wallets.';

    public function handle(StakeUnlockService $svc): int
    {
        if (config('participation_contract.on_chain.enabled')) {
            $this->info('Skipped: on-chain participation uses contract withdraw (not Laravel EMIs).');

            return self::SUCCESS;
        }

        $limit = max(1, (int) $this->option('limit'));
        $paid = $svc->releaseDueEmis($limit);
        $this->info("Stake unlock EMIs paid: {$paid}");

        return self::SUCCESS;
    }
}
