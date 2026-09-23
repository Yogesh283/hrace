<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class DecentralizationCheckCommand extends Command
{
    protected $signature = 'decentralization:check {--json : JSON output}';

    protected $description = 'Verify decentralization internal readiness (no deploy, authoritative must stay false).';

    public function handle(): int
    {
        $checks = [];
        $failed = 0;

        $checks[] = $this->check('authoritative_flag_false', ! (bool) config('income_vault.authoritative_balance'));
        $checks[] = $this->check('income_vault_not_deployed_env', trim((string) config('income_vault.contract_address')) === '');
        $checks[] = $this->check('chain_id_testnet', (int) config('blockchain.chain_id') === 97);
        $checks[] = $this->check('vault_contract_file', File::exists(base_path('contracts/src/RaceIncomeVault.sol')));
        $checks[] = $this->check('indexer_command', class_exists(IndexIncomeVaultEventsCommand::class));
        $checks[] = $this->check('reconcile_command', class_exists(IncomeReconcileOnchainCommand::class));
        $checks[] = $this->check('repair_command', class_exists(IncomeRepairIndexCommand::class));
        $checks[] = $this->check('migration_plans_table_migration', File::exists(
            database_path('migrations/2026_09_19_130000_enhance_on_chain_income_index_and_migration_plans.php'),
        ));
        $checks[] = $this->check('financial_authority_map_doc', File::exists(base_path('docs/FULL_FINANCIAL_AUTHORITY_MAP.md')));
        $checks[] = $this->check('reorg_procedure_doc', File::exists(base_path('docs/BLOCKCHAIN_REORG_PROCEDURE.md')));
        $checks[] = $this->check('migration_runbook_doc', File::exists(base_path('docs/INCOME_MIGRATION_RUNBOOK.md')));

        $incomeVaultJson = base_path('contracts/deployments/bscTestnet/income-vault.json');
        $checks[] = $this->check('income_vault_deploy_artifact_absent', ! File::exists($incomeVaultJson));

        foreach ($checks as $row) {
            if ($row['ok'] === false) {
                $failed++;
            }
        }

        $payload = [
            'DECENTRALIZATION_STATUS' => 'HYBRID',
            'INCOME_VAULT_DEPLOYED' => File::exists($incomeVaultJson) ? 'YES' : 'NO',
            'INCOME_VAULT_AUTHORITATIVE' => config('income_vault.authoritative_balance') ? 'YES' : 'NO',
            'MAINNET_DEPLOYED' => 'NO',
            'checks' => $checks,
            'failed' => $failed,
        ];

        if ($this->option('json')) {
            $this->line(json_encode($payload, JSON_PRETTY_PRINT));
        } else {
            foreach ($checks as $row) {
                $this->line(($row['ok'] ? 'PASS' : 'FAIL').' '.$row['name']);
            }
            $this->info(json_encode([
                'INCOME_VAULT_DEPLOYED' => $payload['INCOME_VAULT_DEPLOYED'],
                'INCOME_VAULT_AUTHORITATIVE' => $payload['INCOME_VAULT_AUTHORITATIVE'],
            ]));
        }

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return array{name: string, ok: bool}
     */
    private function check(string $name, bool $ok): array
    {
        return ['name' => $name, 'ok' => $ok];
    }
}
