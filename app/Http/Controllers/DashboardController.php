<?php

namespace App\Http\Controllers;

use App\Support\MemberCode;
use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Income\RaceCoinService;
use App\Services\Income\ReferralTree;
use App\Services\Income\WalletBalanceService;
use App\Services\Member\MemberActivationService;
use App\Support\IncomeCatalog;
use App\Support\RewardPlan;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * @param  array<string, float|int>  $bucket
     */
    private function pctChange(array $bucket, string $key): string
    {
        $current = (float) ($bucket[$key.'_current'] ?? 0);
        $previous = (float) ($bucket[$key.'_prev'] ?? 0);
        if ($previous <= 0) {
            return $current > 0 ? '+100.00%' : '+0.00%';
        }

        $pct = (($current - $previous) / $previous) * 100;
        $sign = $pct >= 0 ? '+' : '';

        return $sign.number_format($pct, 2, '.', '').'%';
    }

    public function index(Request $request, ReferralTree $referralTree, WalletBalanceService $wallets, RaceCoinService $raceCoin, MemberActivationService $activation): Response
    {
        $user = $request->user()->loadMissing('userWallet');
        $uid = $user->id;
        $walletBalanceUsd = $wallets->currentBalanceFloat($user);
        $raceCoinBalance = $raceCoin->currentBalance($user);

        $directReferrals = User::query()->where('referred_by', $uid)->count();
        $teamSize = $referralTree->referralDescendantCount($uid);
        $descendantIds = $referralTree->referralDescendantIds($uid);

        $lifetimeCredits = (string) (LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->sum('amount_usd') ?? '0');

        $totalIncomeUsd = (string) (LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->sum('amount_usd') ?? '0');

        $planIncome = IncomeCatalog::summarizeForUser($uid);

        $incomeEntries = LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->latest('id')
            ->get([
                'id',
                'entry_type',
                'amount_usd',
                'balance_after_usd',
                'reference_type',
                'reference_id',
                'created_at',
            ])
            ->map(static fn ($row) => [
                'id' => $row->id,
                'income_name' => IncomeCatalog::labelForType((string) $row->entry_type),
                'entry_type' => $row->entry_type,
                'amount_usd' => $row->amount_usd,
                'balance_after_usd' => $row->balance_after_usd,
                'reference_type' => $row->reference_type,
                'reference_id' => $row->reference_id,
                'created_at' => $row->created_at,
            ])
            ->values();

        $principalInvested = (string) (Investment::query()
            ->where('user_id', $uid)
            ->sum('amount_usd') ?? '0');

        $activePrincipalInvested = (string) (Investment::query()
            ->where('user_id', $uid)
            ->where('status', Investment::STATUS_ACTIVE)
            ->sum('amount_usd') ?? '0');

        $roiPaidOnBook = (string) (Investment::query()
            ->where('user_id', $uid)
            ->sum('total_roi_paid_usd') ?? '0');

        $activeInvestments = Investment::query()
            ->where('user_id', $uid)
            ->where('status', Investment::STATUS_ACTIVE)
            ->count();

        $incomeByType = LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->selectRaw('entry_type, SUM(amount_usd) as total')
            ->groupBy('entry_type')
            ->get()
            ->mapWithKeys(fn ($row) => [
                $row->entry_type => number_format((float) $row->total, 2, '.', ''),
            ])
            ->all();

        $today = Carbon::now()->startOfDay();
        $todayEnd = Carbon::now()->endOfDay();

        $todayIncomeUsd = (float) (LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->whereBetween('created_at', [$today, $todayEnd])
            ->sum('amount_usd') ?? 0);

        $todayIncomeCount = (int) LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->whereBetween('created_at', [$today, $todayEnd])
            ->count();

        $currentStart = $today->copy()->subDays(29);
        $previousStart = $today->copy()->subDays(59);
        $previousEnd = $today->copy()->subDays(30)->endOfDay();

        $bucket = [
            'total_current' => 0.0,
            'total_prev' => 0.0,
            'direct_current' => 0.0,
            'direct_prev' => 0.0,
            'matching_current' => 0.0,
            'matching_prev' => 0.0,
            'roi_current' => 0.0,
            'roi_prev' => 0.0,
            'other_current' => 0.0,
            'other_prev' => 0.0,
        ];

        $windowRows = LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->where('created_at', '>=', $previousStart)
            ->get(['entry_type', 'amount_usd', 'created_at']);

        foreach ($windowRows as $row) {
            $amount = (float) $row->amount_usd;
            $inCurrent = $row->created_at?->gte($currentStart);
            $suffix = $inCurrent ? '_current' : '_prev';

            $bucket['total'.$suffix] += $amount;
            if ($row->entry_type === LedgerEntry::TYPE_REFERRAL_DIRECT) {
                $bucket['direct'.$suffix] += $amount;
            } elseif (in_array($row->entry_type, [
                LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD,
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP,
                LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY,
                LedgerEntry::TYPE_COMMUNITY_REFERRAL,
                LedgerEntry::TYPE_AFFILIATE_TEAM_REWARD,
                LedgerEntry::TYPE_AFFILIATE_MTH,
                LedgerEntry::TYPE_AFFILIATE_SPONSOR,
                LedgerEntry::TYPE_AFFILIATE_R10,
                LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP,
                LedgerEntry::TYPE_ACTIVATION_REFERRAL,
                LedgerEntry::TYPE_AFFILIATE_PLACEMENT,
                LedgerEntry::TYPE_AFFILIATE_REFERRAL,
                LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI,
                LedgerEntry::TYPE_BONZA_BUSTER,
            ], true)) {
                $bucket['matching'.$suffix] += $amount;
            } elseif ($row->entry_type === LedgerEntry::TYPE_ROI_MONTHLY || $row->entry_type === LedgerEntry::TYPE_ROI_DAILY) {
                $bucket['roi'.$suffix] += $amount;
            } else {
                $bucket['other'.$suffix] += $amount;
            }
        }

        $recentLedger = LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->latest('id')
            ->limit(5)
            ->get([
                'id',
                'entry_type',
                'amount_usd',
                'balance_after_usd',
                'created_at',
            ]);

        $monthlyMap = [];
        for ($i = 29; $i >= 0; $i--) {
            $d = $today->copy()->subDays($i);
            $key = $d->toDateString();
            $monthlyMap[$key] = [
                'date' => $key,
                'label' => $d->format('d M'),
                'total_usd' => 0.0,
            ];
        }

        $monthRows = LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('amount_usd', '>', 0)
            ->where('entry_type', '!=', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->where('created_at', '>=', $currentStart)
            ->get(['amount_usd', 'created_at']);

        foreach ($monthRows as $row) {
            $key = $row->created_at?->toDateString();
            if ($key && isset($monthlyMap[$key])) {
                $monthlyMap[$key]['total_usd'] += (float) $row->amount_usd;
            }
        }

        $teamMap = [];
        for ($i = 29; $i >= 0; $i--) {
            $d = $today->copy()->subDays($i);
            $key = $d->toDateString();
            $teamMap[$key] = [
                'date' => $key,
                'label' => $d->format('d M'),
                'joins' => 0,
            ];
        }

        if (! empty($descendantIds)) {
            $teamRows = User::query()
                ->whereIn('id', $descendantIds)
                ->where('created_at', '>=', $currentStart)
                ->get(['created_at']);

            foreach ($teamRows as $row) {
                $key = $row->created_at?->toDateString();
                if (! $key || ! isset($teamMap[$key])) {
                    continue;
                }
                $teamMap[$key]['joins']++;
            }
        }

        $directNodes = User::query()
            ->where('referred_by', $uid)
            ->latest('id')
            ->limit(2)
            ->get(['id', 'name', 'member_number']);

        $secondLevel = [];
        foreach ($directNodes as $node) {
            $kids = User::query()
                ->where('referred_by', $node->id)
                ->latest('id')
                ->limit(2)
                ->get(['id', 'name', 'member_number']);
            foreach ($kids as $kid) {
                $secondLevel[] = $kid;
            }
        }

        $directTeamCount = User::query()->where('referred_by', $uid)->count();

        $communityMatchingUsd = (float) ($incomeByType[LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD] ?? 0)
            + (float) ($incomeByType[LedgerEntry::TYPE_COMMUNITY_LEADERSHIP] ?? 0)
            + (float) ($incomeByType[LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_SKIP] ?? 0)
            + (float) ($incomeByType[LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY] ?? 0)
            + (float) ($incomeByType[LedgerEntry::TYPE_COMMUNITY_REFERRAL] ?? 0);

        return Inertia::render('Dashboard', [
            'memberActivation' => $activation->statusFor($user),
            'summary' => [
                'balance_usd' => number_format($walletBalanceUsd, 2, '.', ''),
                'race_coin_balance' => $raceCoinBalance,
                'race_coin_price_usd' => number_format($raceCoin->priceUsd(), 2, '.', ''),
                'lifetime_credits_usd' => number_format((float) $lifetimeCredits, 2, '.', ''),
                'total_income_usd' => number_format((float) $totalIncomeUsd, 2, '.', ''),
                'today_income_usd' => number_format($todayIncomeUsd, 2, '.', ''),
                'today_income_count' => $todayIncomeCount,
                'today_label' => $today->format('M j, Y'),
                'plan_income' => $planIncome,
                'income_entries' => $incomeEntries,
                'income_payout_count' => $incomeEntries->count(),
                'principal_invested_usd' => number_format((float) $principalInvested, 2, '.', ''),
                'active_principal_usd' => number_format((float) $activePrincipalInvested, 2, '.', ''),
                'roi_paid_usd' => number_format((float) $roiPaidOnBook, 2, '.', ''),
                'active_investments' => $activeInvestments,
                'income_by_type' => $incomeByType,
                'recent_ledger' => $recentLedger,
                'direct_referrals' => $directReferrals,
                'team_size' => $teamSize,
                'income_pct' => [
                    'total' => $this->pctChange($bucket, 'total'),
                    'direct' => $this->pctChange($bucket, 'direct'),
                    'matching' => $this->pctChange($bucket, 'matching'),
                    'roi' => $this->pctChange($bucket, 'roi'),
                    'other' => $this->pctChange($bucket, 'other'),
                ],
                'commission_breakdown' => [
                    ['label' => 'Community', 'amount_usd' => number_format($communityMatchingUsd, 2, '.', ''), 'color' => '#3B82F6'],
                    ['label' => 'Direct', 'amount_usd' => number_format((float) ($incomeByType[LedgerEntry::TYPE_REFERRAL_DIRECT] ?? 0), 2, '.', ''), 'color' => '#8B5CF6'],
                    ['label' => 'Participation', 'amount_usd' => number_format((float) ($incomeByType[LedgerEntry::TYPE_ROI_MONTHLY] ?? 0) + (float) ($incomeByType[LedgerEntry::TYPE_ROI_DAILY] ?? 0), 2, '.', ''), 'color' => '#10B981'],
                    ['label' => 'Other', 'amount_usd' => number_format((float) max(0, (float) $totalIncomeUsd - $communityMatchingUsd - (float) ($incomeByType[LedgerEntry::TYPE_REFERRAL_DIRECT] ?? 0) - (float) ($incomeByType[LedgerEntry::TYPE_ROI_MONTHLY] ?? 0) - (float) ($incomeByType[LedgerEntry::TYPE_ROI_DAILY] ?? 0)), 2, '.', ''), 'color' => '#EAB308'],
                ],
                'monthly_income_series' => array_values(array_map(static fn ($row) => [
                    'date' => $row['date'],
                    'label' => $row['label'],
                    'total_usd' => number_format((float) $row['total_usd'], 2, '.', ''),
                ], $monthlyMap)),
                'team_growth_series' => array_values($teamMap),
                'network_preview' => [
                    'direct_nodes' => $directNodes->map(static fn ($u) => [
                        'name' => $u->name,
                        'member_code' => MemberCode::format($u->member_number),
                    ])->values()->all(),
                    'second_level_nodes' => collect($secondLevel)->take(4)->map(static fn ($u) => [
                        'name' => $u->name,
                        'member_code' => MemberCode::format($u->member_number),
                    ])->values()->all(),
                    'direct_team' => $directTeamCount,
                    'total_team' => $teamSize,
                ],
            ],
        ]);
    }
}
