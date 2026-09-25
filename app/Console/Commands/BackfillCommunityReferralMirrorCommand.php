<?php

namespace App\Console\Commands;

use App\Models\IcoPurchase;
use App\Services\Blockchain\BlockchainEventIngestService;
use App\Services\Blockchain\CommunityReferralIndexer;
use Illuminate\Console\Command;

/**
 * Mirror instant on-chain level income (CommunityReferralPaid) into income_wallet_transactions.
 */
class BackfillCommunityReferralMirrorCommand extends Command
{
    protected $signature = 'blockchain:backfill-community-referral-mirror
                            {--receipts : Re-fetch receipts for qualifying ICO purchases missing referral mirror rows}
                            {--report-missed : Print qualifying ICO stakes with zero CommunityReferralPaid on-chain}';

    protected $description = 'Backfill read-model rows for instant ICO/engine level income (not cron ROI).';

    public function handle(
        CommunityReferralIndexer $indexer,
        BlockchainEventIngestService $ingest,
    ): int {
        if ($this->option('receipts')) {
            $this->info('Re-ingesting ICO purchase receipts (qualifying $50+)…');
            IcoPurchase::query()
                ->where('usdt_amount', '>=', 50)
                ->orderBy('id')
                ->each(function (IcoPurchase $p) use ($ingest) {
                    $tx = strtolower(trim((string) $p->tx_hash));
                    if ($tx === '') {
                        return;
                    }
                    $result = $ingest->ingestFromTxHash($tx);
                    if (! ($result['ok'] ?? false)) {
                        $this->warn("skip tx {$tx}: ".($result['reason'] ?? 'unknown'));

                        return;
                    }
                    $this->line("indexed tx {$tx}: ".($result['events_indexed'] ?? 0).' new event(s)');
                });
        }

        $created = $indexer->backfillFromBlockchainEvents();
        $this->info("Mirrored {$created} CommunityReferralPaid event(s) into income_wallet_transactions.");

        if ($this->option('report-missed')) {
            $this->call('blockchain:report-missed-ico-referrals');
        }

        return self::SUCCESS;
    }
}
