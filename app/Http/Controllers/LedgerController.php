<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Services\Blockchain\OnChainLevelIncomeRows;
use App\Support\IncomeCatalog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LedgerController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $incomeKey = $request->string('income')->toString();
        if ($incomeKey === '') {
            $incomeKey = null;
        }

        $query = LedgerEntry::query()
            ->production()
            ->where('user_id', $user->id);

        if ($incomeKey) {
            IncomeCatalog::applyIncomeKeyFilter($query, $incomeKey);
        }

        $dateParam = $request->string('date')->toString();
        $showAllDates = $dateParam === 'all';
        $filterDate = null;
        if (! $showAllDates) {
            if ($dateParam === '') {
                $filterDate = Carbon::today();
            } else {
                try {
                    $filterDate = Carbon::parse($dateParam)->startOfDay();
                } catch (\Throwable) {
                    $filterDate = Carbon::today();
                }
            }
            $query->whereDate('created_at', $filterDate);
        }

        $dayTotalUsd = null;
        if (! $showAllDates) {
            $dayTotalUsd = number_format(
                (float) ((clone $query)->where('amount_usd', '>', 0)->sum('amount_usd') ?? 0),
                2,
                '.',
                '',
            );
        }

        $entries = IncomeCatalog::formatLedgerRows(
            $query
                ->latest('id')
                ->limit(200)
                ->get([
                    'id',
                    'entry_type',
                    'amount_usd',
                    'balance_after_usd',
                    'reference_type',
                    'reference_id',
                    'meta',
                    'created_at',
                ]),
        );

        $onChainLevel = app(OnChainLevelIncomeRows::class);
        $includeOnChainLevel = $incomeKey === null || $incomeKey === 'community_referrals';
        $raceIncome = ['race' => '0.0000', 'usdt' => '0.00'];
        if ($includeOnChainLevel) {
            $entries = collect($entries)
                ->concat($onChainLevel->forUser($user, $showAllDates ? null : $filterDate))
                ->sortByDesc(static fn (array $row) => (string) $row['created_at'])
                ->take(200)
                ->values()
                ->all();
            $raceIncome = $onChainLevel->totalsForUser($user);
        }

        $filterLabel = null;
        if ($incomeKey) {
            foreach (IncomeCatalog::items() as $item) {
                if (($item['key'] ?? '') === $incomeKey) {
                    $filterLabel = $item['label'];
                    break;
                }
            }
        }

        $totalEarningsUsd = IncomeCatalog::totalIncomeUsd($user->id);

        $filteredEarningsUsd = null;
        if ($incomeKey) {
            $scoped = IncomeCatalog::totalsForIncomeKey($user->id, $incomeKey);
            $filteredEarningsUsd = number_format($scoped['sum'], 2, '.', '');
        }

        $today = Carbon::today();

        return Inertia::render('Transactions', [
            'entries' => $entries,
            'filter_income_key' => $incomeKey,
            'filter_label' => $filterLabel,
            'total_earnings_usd' => $totalEarningsUsd,
            'filtered_earnings_usd' => $filteredEarningsUsd,
            'filter_date' => $showAllDates ? 'all' : ($filterDate?->toDateString() ?? $today->toDateString()),
            'filter_date_label' => $showAllDates
                ? 'All dates'
                : ($filterDate?->isSameDay($today) ? 'Today' : $filterDate?->format('D, M j, Y')),
            'max_date' => $today->toDateString(),
            'day_total_usd' => $dayTotalUsd,
            'race_level_income' => $raceIncome,
        ]);
    }
}
