<?php

namespace App\Console\Commands;

use App\Services\Income\HoldingRolloverService;
use Illuminate\Console\Command;

class IncomeRolloverHoldingsCommand extends Command
{
    protected $signature = 'income:rollover-holdings {--limit=200 : Max stakes to rollover}';

    protected $description = 'T&C: auto-rollover completed stakes not unlocked within 24h into the same holding cycle.';

    public function handle(HoldingRolloverService $svc): int
    {
        if (config('participation_contract.on_chain.enabled')) {
            $this->info('Skipped: on-chain participation handles locks on-chain.');

            return self::SUCCESS;
        }

        $n = $svc->rolloverDue(max(1, (int) $this->option('limit')));
        $this->info("Holding rollovers applied: {$n}");

        return self::SUCCESS;
    }
}
