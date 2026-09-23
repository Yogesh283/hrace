<?php

namespace App\Console\Commands;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use App\Services\Income\VirtualIncomeCompoundService;
use Illuminate\Console\Command;

class IncomeReconcilePendingCompoundsCommand extends Command
{
    protected $signature = 'income:reconcile-pending-compounds {--dry-run : Report only}';

    protected $description = 'Refund expired virtual compound reservations without on-chain confirmation.';

    public function handle(VirtualIncomeCompoundService $compound): int
    {
        $dry = (bool) $this->option('dry-run');
        $ttlHours = (int) config('virtual_income_wallet.compound_reserve_ttl_hours', 24);
        $cutoff = now()->subHours($ttlHours);

        $rows = IncomeWalletTransaction::query()
            ->where('type', IncomeWalletTransaction::TYPE_COMPOUND)
            ->where('direction', IncomeWalletTransaction::DIRECTION_DEBIT)
            ->where('created_at', '<', $cutoff)
            ->get();

        $refunded = 0;
        foreach ($rows as $row) {
            $meta = is_array($row->metadata) ? $row->metadata : [];
            $phase = (string) ($meta['phase'] ?? '');
            if ($phase === 'confirmed_on_chain') {
                continue;
            }
            if ($dry) {
                $this->line("DRY-RUN refund user={$row->user_id} id={$row->id} key={$row->idempotency_key}");
                $refunded++;

                continue;
            }
            try {
                $user = User::query()->find($row->user_id);
                if (! $user) {
                    continue;
                }
                $compound->refundReserve($user, (string) $row->idempotency_key, 'expired_ttl');
                $refunded++;
            } catch (\Throwable $e) {
                $this->warn("Skip id={$row->id}: {$e->getMessage()}");
            }
        }

        $this->info("Pending compound reconciliation: {$refunded} row(s)".($dry ? ' (dry-run)' : ''));

        return self::SUCCESS;
    }
}
