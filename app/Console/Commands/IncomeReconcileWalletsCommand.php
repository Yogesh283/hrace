<?php

namespace App\Console\Commands;

use App\Models\IncomeWalletTransaction;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\VirtualIncomeWalletService;
use Illuminate\Console\Command;

class IncomeReconcileWalletsCommand extends Command
{
    protected $signature = 'income:reconcile-wallets {--dry-run : Report drift only} {--user= : Limit to user id}';

    protected $description = 'Compare virtual income_wallet_transactions vs mirrored ledger types (report only).';

    public function handle(VirtualIncomeWalletService $virtual): int
    {
        $dry = (bool) $this->option('dry-run');
        $userId = $this->option('user');
        $map = config('virtual_income_wallet.ledger_type_map', []);
        $creditTypes = array_keys(array_filter($map, static fn ($v) => $v !== null));

        $query = User::query()->orderBy('id');
        if ($userId) {
            $query->whereKey((int) $userId);
        }

        $critical = 0;
        $checked = 0;

        $query->chunk(100, function ($users) use ($virtual, $creditTypes, $dry, &$critical, &$checked) {
            foreach ($users as $user) {
                $checked++;
                $virtualBal = $virtual->availableBalance($user);
                $ledgerSum = (string) (LedgerEntry::query()
                    ->where('user_id', $user->id)
                    ->production()
                    ->whereIn('entry_type', $creditTypes)
                    ->where('amount_usd', '>', 0)
                    ->sum('amount_usd') ?? '0');
                $ledgerSum = number_format((float) $ledgerSum, 2, '.', '');
                $virtualDisplay = number_format((float) $virtualBal, 2, '.', '');
                $drift = bcsub($virtualDisplay, $ledgerSum, 2);
                if (bccomp(ltrim($drift, '-'), '0.01', 2) > 0) {
                    $critical++;
                    $this->warn("DRIFT user={$user->id} virtual={$virtualDisplay} ledger_mirror={$ledgerSum} delta={$drift}");
                }
            }
        });

        $this->info("Reconciliation checked={$checked} critical_drift={$critical}".($dry ? ' (dry-run)' : ''));

        return $critical > 0 ? self::FAILURE : self::SUCCESS;
    }
}
