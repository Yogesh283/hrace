<?php

namespace App\Console\Commands;

use App\Models\IcoPurchase;
use App\Services\Blockchain\IcoPurchaseCatchUpService;
use Illuminate\Console\Command;

class BackfillIcoPurchasesCommand extends Command
{
    protected $signature = 'blockchain:backfill-ico-purchases
        {--tx=* : Extra tx hashes to ingest}
        {--blocks=4000 : How far back to scan ICOPurchased logs}';

    protected $description = 'Catch RaceICO buys missing from ico_purchases (every-minute cron).';

    public function handle(IcoPurchaseCatchUpService $catchUp): int
    {
        $result = $catchUp->catchUp((int) $this->option('blocks'), $this->option('tx'));
        $this->info(
            'scanned='.$result['scanned']
            .' ingested='.$result['ingested']
            .' ico_purchases='.$result['rows']
            .' usdt='.IcoPurchase::query()->sum('usdt_amount')
        );

        return self::SUCCESS;
    }
}
