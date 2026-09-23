<?php

namespace App\Console\Commands;

use App\Models\OnChainIncomeBalance;
use App\Models\User;
use App\Services\Blockchain\OnChainIncomeReadService;
use App\Services\Income\VirtualIncomeWalletService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class IncomeMigrationReportCommand extends Command
{
    protected $signature = 'income:migration-report {--output=docs/INCOME_MIGRATION_REPORT.md}';

    protected $description = 'Generate virtual vs on-chain balance migration report (no automatic migration).';

    public function handle(VirtualIncomeWalletService $virtual, OnChainIncomeReadService $onChain): int
    {
        $path = base_path($this->option('output'));
        $lines = [
            '# Income Migration Report',
            '',
            'Generated: '.now()->toIso8601String(),
            '',
            '| User ID | Wallet | Legacy virtual balance | On-chain indexed balance | Difference | Status |',
            '|--------:|--------|------------------------:|-------------------------:|-----------:|--------|',
        ];

        User::query()
            ->whereNotNull('wallet_address')
            ->where('wallet_address', '!=', '')
            ->orderBy('id')
            ->chunk(200, function ($users) use ($virtual, $onChain, &$lines) {
                foreach ($users as $user) {
                    $legacy = $virtual->sumBalance((int) $user->id);
                    $wallet = strtolower((string) $user->wallet_address);
                    $row = OnChainIncomeBalance::query()->where('wallet_address', $wallet)->first();
                    $onChainBal = $row
                        ? number_format((float) $row->balance_amount, 4, '.', '')
                        : ($onChain->balanceForUser($user) ?? '0.0000');
                    $diff = bcsub($legacy, $onChainBal, 4);
                    $status = bccomp($diff, '0', 4) === 0 ? 'aligned' : 'migration_pending';
                    $lines[] = sprintf(
                        '| %d | `%s` | %s | %s | %s | %s |',
                        $user->id,
                        $wallet,
                        $legacy,
                        $onChainBal,
                        $diff,
                        $status,
                    );
                }
            });

        $lines[] = '';
        $lines[] = 'No migration executed automatically. Use signed `migrateIncome` on RaceIncomeVault for controlled legacy moves.';

        File::ensureDirectoryExists(dirname($path));
        File::put($path, implode("\n", $lines)."\n");
        $this->info('Wrote '.$path);

        return self::SUCCESS;
    }
}
