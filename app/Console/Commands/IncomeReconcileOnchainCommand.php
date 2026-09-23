<?php

namespace App\Console\Commands;

use App\Services\Blockchain\IncomeOnChainReconciler;
use Illuminate\Console\Command;

class IncomeReconcileOnchainCommand extends Command
{
    protected $signature = 'income:reconcile-onchain
        {--wallet= : Optional single wallet}
        {--json : Machine-readable output}
        {--index-only : Skip RPC chain reads (vault not deployed)}';

    protected $description = 'Compare RaceIncomeVault chain state vs Laravel index (blockchain wins).';

    public function handle(IncomeOnChainReconciler $reconciler): int
    {
        $requireRpc = ! $this->option('index-only');
        if ($requireRpc && config('income_vault.contract_address') === '') {
            $this->warn('RACE_INCOME_VAULT_CONTRACT empty — use --index-only or deploy vault first.');

            return self::FAILURE;
        }

        $result = $reconciler->reconcileWallets($this->option('wallet'), $requireRpc);
        $dupes = $reconciler->detectDuplicateEventKeys();

        if ($this->option('json')) {
            $this->line(json_encode([
                'income_vault_deployed' => config('income_vault.contract_address') !== '',
                'income_vault_authoritative' => (bool) config('income_vault.authoritative_balance'),
                'rows' => $result['rows'],
                'summary' => $result['summary'],
                'duplicate_events' => $dupes,
            ], JSON_PRETTY_PRINT));

            return $this->exitFromSummary($result['summary'], $dupes);

        }

        foreach ($result['rows'] as $row) {
            $this->line(sprintf(
                '%s wallet=%s index=%s chain=%s legacy=%s',
                $row['status'],
                $row['wallet'],
                $row['index_balance'],
                $row['blockchain_balance'] ?? 'n/a',
                $row['legacy_virtual_balance'],
            ));
        }
        if ($dupes !== []) {
            $this->error('DUPLICATE event keys: '.count($dupes));
        }
        $this->info('Summary: '.json_encode($result['summary']));

        return $this->exitFromSummary($result['summary'], $dupes);
    }

    /**
     * @param  array<string, int>  $summary
     * @param  list<array<string, mixed>>  $dupes
     */
    private function exitFromSummary(array $summary, array $dupes): int
    {
        if ($dupes !== []) {
            return self::FAILURE;
        }
        if (($summary[IncomeOnChainReconciler::STATUS_MISMATCH] ?? 0) > 0) {
            return self::FAILURE;
        }
        if (($summary[IncomeOnChainReconciler::STATUS_DUPLICATE] ?? 0) > 0) {
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
