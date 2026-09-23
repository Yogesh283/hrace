<?php

namespace App\Http\Controllers;

use App\Models\Withdrawal;
use App\Models\SiteSetting;
use App\Services\Income\IncomeAccrualService;
use App\Services\Income\WalletBalanceService;
use App\Services\Income\WithdrawalService;
use App\Support\RewardPlan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WithdrawalController extends Controller
{
    public function index(Request $request, WalletBalanceService $wallets, WithdrawalService $withdrawalService): Response
    {
        $user = $request->user()->loadMissing('userWallet');
        $feeRules = RewardPlan::walletWithdrawalFeeRulesForUi();
        $incomePolicy = app(IncomeAccrualService::class)->summaryForUser($user, $wallets);

        $withdrawals = Withdrawal::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(50)
            ->get(['id', 'amount_usd', 'fee_usd', 'team_reward_usd', 'admin_fee_usd', 'net_usd', 'status', 'created_at'])
            ->map(static fn (Withdrawal $w) => [
                'id' => $w->id,
                'amount_usd' => $w->amount_usd,
                'fee_usd' => $w->fee_usd,
                'team_reward_usd' => $w->teamRewardUsd(),
                'admin_fee_usd' => $w->adminFeeUsd(),
                'net_usd' => $w->net_usd,
                'status' => $w->status,
                'status_label' => Withdrawal::statusLabels()[$w->status] ?? ucfirst((string) $w->status),
                'created_at' => $w->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return Inertia::render('Withdrawal', [
            'balance_usd' => $wallets->virtualIncomeBalance($user),
            'income_policy' => $incomePolicy,
            'wallet_address' => $user->wallet_address,
            'withdrawal_fee' => $feeRules,
            'admin_wallet' => [
                'address' => SiteSetting::treasuryAddress(),
                'network' => SiteSetting::treasuryNetworkLabel(),
            ],
            'withdrawals_disabled' => ! $user->canRequestWithdrawal(),
            'rate_limit' => $withdrawalService->rateLimitStatus($user),
            'withdrawals' => $withdrawals,
        ]);
    }

    public function store(Request $request, WithdrawalService $withdrawals): RedirectResponse
    {
        $validated = $request->validate([
            'amount_usd' => ['required', 'numeric', 'min:1', 'max:999999.99'],
            'destination_address' => ['required', 'string', 'min:10', 'max:255'],
        ]);

        try {
            $withdrawal = $withdrawals->request(
                $request->user(),
                (string) $validated['amount_usd'],
                (string) $validated['destination_address'],
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', __('Withdrawal could not be completed. Please try again.'));
        }

        return back()->with(
            'status',
            __('Withdrawal request submitted. It will be processed after admin approval. Net :net USDT (Team Reward :team + Admin Fee :admin deducted).', [
                'net' => number_format((float) $withdrawal->net_usd, 2),
                'team' => number_format((float) $withdrawal->teamRewardUsd(), 2),
                'admin' => number_format((float) $withdrawal->adminFeeUsd(), 2),
            ]),
        );
    }
}
