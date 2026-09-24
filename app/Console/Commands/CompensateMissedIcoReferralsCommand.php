<?php

namespace App\Console\Commands;

use App\Models\IcoReferralCompensation;
use App\Services\Blockchain\MissedIcoReferralCompensationService;
use Illuminate\Console\Command;

class CompensateMissedIcoReferralsCommand extends Command
{
    protected $signature = 'blockchain:compensate-missed-ico-referrals
                            {--sync-db : Insert pending rows into ico_referral_compensations (idempotent)}
                            {--write-export : Write storage/app/ico-referral-compensation-export.json for Hardhat script}
                            {--mark-paid= : Mark idempotency keys paid with payout tx (comma-separated key:tx)}';

    protected $description = 'Plan/settle missed instant ICO level income (manual on-chain RACE payout + DB tracking).';

    public function handle(MissedIcoReferralCompensationService $planner): int
    {
        if ($mark = $this->option('mark-paid')) {
            foreach (explode(',', (string) $mark) as $pair) {
                $parts = explode(':', trim($pair), 2);
                if (count($parts) !== 2) {
                    continue;
                }
                [$key, $tx] = $parts;
                IcoReferralCompensation::query()
                    ->where('idempotency_key', trim($key))
                    ->update([
                        'status' => IcoReferralCompensation::STATUS_PAID,
                        'payout_tx_hash' => strtolower(trim($tx)),
                    ]);
            }
            $this->info('Marked compensation row(s) paid.');

            return self::SUCCESS;
        }

        $plan = $planner->planPendingCompensations();
        if ($plan === []) {
            $this->info('No pending missed ICO level income (or all stakes already had on-chain referral).');

            return self::SUCCESS;
        }

        if ($this->option('sync-db')) {
            $inserted = 0;
            foreach ($plan as $bucket) {
                foreach ($bucket['line_items'] as $row) {
                    $created = IcoReferralCompensation::query()->firstOrCreate(
                        ['idempotency_key' => $row['idempotency_key']],
                        [
                            'ico_purchase_id' => $row['ico_purchase_id'],
                            'sponsor_user_id' => $row['sponsor_user_id'],
                            'sponsor_wallet' => $row['sponsor_wallet'],
                            'level' => $row['level'],
                            'amount_usd' => $row['amount_usd'],
                            'amount_race' => $row['amount_race'],
                            'stake_tx_hash' => $row['stake_tx_hash'],
                            'status' => IcoReferralCompensation::STATUS_PENDING,
                            'meta' => [
                                'buyer_user_id' => $row['buyer_user_id'],
                                'percent' => $row['percent'],
                            ],
                        ],
                    );
                    if ($created->wasRecentlyCreated) {
                        $inserted++;
                    }
                }
            }
            $this->info("Synced {$inserted} new pending compensation row(s).");
        }

        $payload = ['compensation_plan' => $plan];
        $this->line(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        if ($this->option('write-export')) {
            $path = storage_path('app/ico-referral-compensation-export.json');
            file_put_contents($path, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            $this->info("Wrote {$path}");
        }

        $this->newLine();
        $this->info('Pay on testnet (payer needs RACE balance + DEPLOYER_PRIVATE_KEY in contracts/.env):');
        $this->line('  CONFIRM_TESTNET_COMPENSATION=YES npm run compensate:missed-ico-referrals-testnet');

        return self::SUCCESS;
    }
}
