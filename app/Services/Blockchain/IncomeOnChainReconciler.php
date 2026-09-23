<?php

namespace App\Services\Blockchain;

use App\Models\IncomeMigrationPlan;
use App\Models\IncomeWalletTransaction;
use App\Models\OnChainIncomeBalance;
use App\Models\OnChainIncomeLedgerEntry;
use App\Models\User;
use App\Services\Income\VirtualIncomeWalletService;

class IncomeOnChainReconciler
{
    public const STATUS_MATCH = 'MATCH';

    public const STATUS_MISMATCH = 'MISMATCH';

    public const STATUS_MISSING_ON_CHAIN = 'MISSING_ON_CHAIN';

    public const STATUS_MISSING_IN_INDEX = 'MISSING_IN_INDEX';

    public const STATUS_DUPLICATE = 'DUPLICATE';

    public const STATUS_ORPHANED = 'ORPHANED';

    public function __construct(
        private readonly VirtualIncomeWalletService $virtualWallet,
        private readonly IncomeVaultIndexer $indexer,
    ) {}

    /**
     * @return array{rows: list<array<string, mixed>>, summary: array<string, int>}
     */
    public function reconcileWallets(?string $walletFilter = null, bool $requireRpc = true): array
    {
        $contract = trim((string) config('income_vault.contract_address'));
        $rows = [];
        $summary = [
            self::STATUS_MATCH => 0,
            self::STATUS_MISMATCH => 0,
            self::STATUS_MISSING_ON_CHAIN => 0,
            self::STATUS_MISSING_IN_INDEX => 0,
            self::STATUS_DUPLICATE => 0,
            self::STATUS_ORPHANED => 0,
        ];

        $query = User::query()->whereNotNull('wallet_address')->where('wallet_address', '!=', '');
        if ($walletFilter) {
            $query->where('wallet_address', strtolower($walletFilter));
        }

        $query->orderBy('id')->chunk(100, function ($users) use (&$rows, &$summary, $contract, $requireRpc) {
            foreach ($users as $user) {
                $wallet = strtolower((string) $user->wallet_address);
                $readRow = OnChainIncomeBalance::query()->where('wallet_address', $wallet)->first();
                $indexBal = $readRow ? (string) $readRow->balance_amount : '0';
                $legacyBal = $this->virtualWallet->sumBalance((int) $user->id);
                $migrated = (string) IncomeMigrationPlan::query()
                    ->where('wallet_address', $wallet)
                    ->where('status', IncomeMigrationPlan::STATUS_CONFIRMED)
                    ->sum('planned_amount_usd');

                $chainBal = null;
                if ($contract !== '' && $requireRpc) {
                    $chainBal = $this->indexer->chainBalanceForWallet($wallet);
                }

                $indexFormatted = number_format((float) $indexBal, 8, '.', '');
                $chainFormatted = $chainBal !== null
                    ? number_format((float) $chainBal, 8, '.', '')
                    : null;

                if (! $requireRpc) {
                    $status = self::STATUS_ORPHANED;
                } elseif ($contract === '') {
                    $status = self::STATUS_MISSING_ON_CHAIN;
                } elseif ($chainBal === null) {
                    $status = self::STATUS_MISSING_ON_CHAIN;
                } elseif ($readRow === null && bccomp($chainFormatted, '0', 8) > 0) {
                    $status = self::STATUS_MISSING_IN_INDEX;
                } elseif (bccomp($indexFormatted, $chainFormatted, 8) !== 0) {
                    $status = self::STATUS_MISMATCH;
                } else {
                    $status = self::STATUS_MATCH;
                }

                $summary[$status] = ($summary[$status] ?? 0) + 1;

                $indexCredits = (string) OnChainIncomeLedgerEntry::query()
                    ->where('wallet_address', $wallet)
                    ->whereIn('event_name', ['IncomeCredited', 'IncomeMigrated'])
                    ->sum('amount');
                $indexDebits = (string) OnChainIncomeLedgerEntry::query()
                    ->where('wallet_address', $wallet)
                    ->where('event_name', 'IncomeWithdrawal')
                    ->sum('amount');

                $rows[] = [
                    'user_id' => $user->id,
                    'wallet' => $wallet,
                    'status' => $status,
                    'blockchain_balance' => $chainBal,
                    'index_balance' => $indexBal,
                    'laravel_balance' => $legacyBal,
                    'legacy_virtual_balance' => $legacyBal,
                    'index_credits' => $indexCredits,
                    'index_debits' => $indexDebits,
                    'migrated_confirmed_usd' => $migrated,
                    'difference_index_vs_chain' => ($chainBal !== null)
                        ? bcsub($indexFormatted, $chainFormatted, 8)
                        : null,
                ];
            }
        });

        return ['rows' => $rows, 'summary' => $summary];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function detectDuplicateEventKeys(): array
    {
        return OnChainIncomeLedgerEntry::query()
            ->selectRaw('chain_id, tx_hash, log_index, COUNT(*) as cnt')
            ->groupBy('chain_id', 'tx_hash', 'log_index')
            ->having('cnt', '>', 1)
            ->get()
            ->map(fn ($r) => [
                'chain_id' => $r->chain_id,
                'tx_hash' => $r->tx_hash,
                'log_index' => $r->log_index,
                'count' => (int) $r->cnt,
                'status' => self::STATUS_DUPLICATE,
            ])
            ->all();
    }
}
