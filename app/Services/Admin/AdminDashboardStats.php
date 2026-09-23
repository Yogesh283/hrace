<?php

namespace App\Services\Admin;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\RaceCoinSwap;
use App\Models\User;
use App\Models\UserWallet;
use App\Models\Withdrawal;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class AdminDashboardStats
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public function summarize(): array
    {
        $today = now()->startOfDay();

        return [
            'deposits' => $this->whenTable(
                (new LedgerEntry)->getTable(),
                fn () => $this->ledgerMetric(
                    LedgerEntry::query()
                        ->production()
                        ->where('entry_type', LedgerEntry::TYPE_WALLET_DEPOSIT),
                    $today,
                    absAmount: true,
                ),
            ),
            'withdrawals' => $this->whenTable(
                (new Withdrawal)->getTable(),
                fn () => $this->tableMetric(Withdrawal::query(), $today, 'amount_usd'),
            ),
            'users' => $this->whenTable(
                (new User)->getTable(),
                fn () => $this->userMetric($today),
            ),
            'investments' => $this->whenTable(
                (new Investment)->getTable(),
                fn () => $this->tableMetric(Investment::query(), $today, 'amount_usd'),
            ),
            'income_payouts' => $this->whenTable(
                (new LedgerEntry)->getTable(),
                fn () => $this->ledgerMetric(
                    LedgerEntry::query()
                        ->production()
                        ->whereNotIn('entry_type', [
                            LedgerEntry::TYPE_WALLET_DEPOSIT,
                            LedgerEntry::TYPE_WALLET_WITHDRAWAL,
                            LedgerEntry::TYPE_INVESTMENT_DEBIT,
                        ])
                        ->where('amount_usd', '>', 0),
                    $today,
                ),
            ),
            'race_coin_swaps' => $this->whenTable(
                (new RaceCoinSwap)->getTable(),
                fn () => $this->tableMetric(
                    RaceCoinSwap::query()->where('swap_type', RaceCoinSwap::TYPE_SWAP_CREDIT),
                    $today,
                    'usdt_amount',
                ),
            ),
            'race_coin_supply' => $this->whenTable(
                (new UserWallet)->getTable(),
                fn () => $this->raceCoinSupplyMetric(),
            ),
        ];
    }

    /**
     * @return array{today_count: int, today_amount: string, total_count: int, total_amount: string, is_count_only: bool}
     */
    private function whenTable(string $table, callable $callback): array
    {
        if (! Schema::hasTable($table)) {
            return $this->emptyMetric($table === (new User)->getTable());
        }

        return $callback();
    }

    /**
     * @return array{today_count: int, today_amount: string, total_count: int, total_amount: string, is_count_only: bool}
     */
    private function emptyMetric(bool $countOnly = false): array
    {
        return [
            'today_count' => 0,
            'today_amount' => $countOnly ? '0' : $this->formatMoney(0),
            'total_count' => 0,
            'total_amount' => $countOnly ? '0' : $this->formatMoney(0),
            'is_count_only' => $countOnly,
        ];
    }

    /**
     * @param  Builder<Model>  $query
     * @return array{today_count: int, today_amount: string, total_count: int, total_amount: string, is_count_only: bool}
     */
    private function tableMetric(Builder $query, CarbonInterface $today, string $amountColumn): array
    {
        return [
            'today_count' => (int) (clone $query)->where('created_at', '>=', $today)->count(),
            'today_amount' => $this->formatMoney((clone $query)->where('created_at', '>=', $today)->sum($amountColumn)),
            'total_count' => (int) $query->count(),
            'total_amount' => $this->formatMoney((clone $query)->sum($amountColumn)),
            'is_count_only' => false,
        ];
    }

    /**
     * @param  Builder<LedgerEntry>  $query
     * @return array{today_count: int, today_amount: string, total_count: int, total_amount: string, is_count_only: bool}
     */
    private function ledgerMetric(Builder $query, CarbonInterface $today, bool $absAmount = false): array
    {
        $todayQ = (clone $query)->where('created_at', '>=', $today);
        $todayCount = (int) $todayQ->count();
        $totalCount = (int) $query->count();

        if ($absAmount) {
            $todayAmount = $this->sumAbs($todayQ);
            $totalAmount = $this->sumAbs(clone $query);
        } else {
            $todayAmount = (float) $todayQ->sum('amount_usd');
            $totalAmount = (float) (clone $query)->sum('amount_usd');
        }

        return [
            'today_count' => $todayCount,
            'today_amount' => $this->formatMoney($todayAmount),
            'total_count' => $totalCount,
            'total_amount' => $this->formatMoney($totalAmount),
            'is_count_only' => false,
        ];
    }

    /**
     * @param  Builder<LedgerEntry>  $query
     */
    private function sumAbs(Builder $query): float
    {
        return (float) ((clone $query)
            ->selectRaw('COALESCE(SUM(ABS(CAST(amount_usd AS DECIMAL(15,2)))), 0) as total')
            ->value('total') ?? 0);
    }

    /**
     * @return array{today_count: int, today_amount: string, total_count: int, total_amount: string, is_count_only: bool}
     */
    private function userMetric(CarbonInterface $today): array
    {
        $todayCount = (int) User::query()->where('created_at', '>=', $today)->count();
        $totalCount = (int) User::query()->count();

        return [
            'today_count' => $todayCount,
            'today_amount' => (string) $todayCount,
            'total_count' => $totalCount,
            'total_amount' => (string) $totalCount,
            'is_count_only' => true,
        ];
    }

    private function formatMoney(float|string $value): string
    {
        return number_format((float) $value, 2, '.', ',');
    }

    /**
     * @return array{today_count: int, today_amount: string, total_count: int, total_amount: string, is_count_only: bool}
     */
    private function raceCoinSupplyMetric(): array
    {
        $total = (float) (UserWallet::query()->sum('race_coin_balance') ?? 0);

        return [
            'today_count' => 0,
            'today_amount' => number_format($total, 4, '.', ',').' RC',
            'total_count' => (int) UserWallet::query()->where('race_coin_balance', '>', 0)->count(),
            'total_amount' => number_format($total, 4, '.', ',').' RC',
            'is_count_only' => false,
            'is_race_coin' => true,
        ];
    }
}
