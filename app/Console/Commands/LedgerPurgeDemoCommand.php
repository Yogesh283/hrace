<?php

namespace App\Console\Commands;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\WalletBalanceService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class LedgerPurgeDemoCommand extends Command
{
    protected $signature = 'ledger:purge-demo
                            {--user= : Limit to user id}
                            {--dry-run : List rows without deleting}';

    protected $description = 'Remove demo/seed ledger entries and recalculate wallet balances from real transactions';

    public function handle(WalletBalanceService $wallets): int
    {
        $query = LedgerEntry::query()->where(function ($q) {
            $q->where('reference_type', 'demo')
                ->orWhere('meta->demo_seed', true)
                ->orWhereNotNull('meta->seed');
        });

        if ($userId = $this->option('user')) {
            $query->where('user_id', (int) $userId);
        }

        $rows = $query->get();
        if ($rows->isEmpty()) {
            $this->info('No demo/seed ledger rows found.');

            return self::SUCCESS;
        }

        $this->warn('Found '.$rows->count().' demo/seed ledger row(s).');

        if ($this->option('dry-run')) {
            $this->table(
                ['id', 'user_id', 'entry_type', 'amount_usd', 'reference_type'],
                $rows->map(fn (LedgerEntry $r) => [
                    $r->id,
                    $r->user_id,
                    $r->entry_type,
                    $r->amount_usd,
                    $r->reference_type,
                ])->all(),
            );

            return self::SUCCESS;
        }

        $userIds = $rows->pluck('user_id')->unique();
        $ids = $rows->pluck('id');

        DB::transaction(function () use ($ids) {
            LedgerEntry::query()->whereIn('id', $ids)->delete();
        });

        foreach ($userIds as $uid) {
            $user = User::query()->find($uid);
            if ($user) {
                $bal = $wallets->recalculateFromLedger($user);
                $this->line("User #{$uid} wallet recalculated: \${$bal}");
            }
        }

        $this->info('Demo ledger rows removed. Dashboard now shows only real transactions.');

        return self::SUCCESS;
    }
}
