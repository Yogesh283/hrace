<?php

namespace App\Http\Controllers;

use App\Services\Blockchain\BlockchainContractPayload;
use App\Services\Blockchain\CommunityEngineStakeReadService;
use App\Models\Investment;
use App\Services\Income\CompoundStakeService;
use App\Services\Income\IncomeAccrualService;
use App\Services\Income\IncomeClaimService;
use App\Services\Income\InvestmentRecorder;
use App\Services\Income\RaceCoinService;
use App\Services\Income\R10LeadershipService;
use App\Services\Income\StakeUnlockService;
use App\Services\Income\WalletBalanceService;
use App\Services\Member\MemberActivationService;
use App\Support\OnChainReferrer;
use App\Support\RewardPlan;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class InvestmentController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Investment', $this->investmentPageProps($request));
    }

    public function selfHold(Request $request): Response
    {
        $svc = app(R10LeadershipService::class);

        $investments = Investment::query()
            ->where('user_id', $request->user()->id)
            ->latest('id')
            ->limit(50)
            ->get([
                'id',
                'amount_usd',
                'duration_days',
                'roi_percent_daily',
                'total_roi_paid_usd',
                'status',
                'created_at',
            ]);

        return Inertia::render('SelfHold', [
            'self_hold_usd' => $svc->selfActiveHoldUsd($request->user()->id),
            'investments' => $investments,
        ]);
    }

    public function store(Request $request, InvestmentRecorder $recorder): RedirectResponse
    {
        if (config('participation_contract.on_chain.enabled') || \App\Support\BlockchainMode::blockchainOnly()) {
            return back()->withErrors([
                'amount_usd' => __('Staking is on-chain only. Connect your wallet and purchase via the smart contract.'),
            ]);
        }
        $growth = RewardPlan::builtForGrowth();
        $min = (float) ($growth['min_amount_usd'] ?? 1);
        $max = (float) ($growth['max_amount_usd'] ?? 999_999_999.99);
        $allowedDurations = RewardPlan::growthAllowedDurations();

        $request->validate([
            'amount_usd' => ['required', 'numeric', 'min:'.$min, 'max:'.$max],
            'duration_days' => ['required', 'integer', Rule::in($allowedDurations)],
            'payment_method' => ['required', 'string', Rule::in([
                InvestmentRecorder::PAYMENT_USDT_WALLET,
                InvestmentRecorder::PAYMENT_RACE_COIN,
            ])],
        ]);

        $user = $request->user();
        $wasFirstParticipation = $user->participation_activated_at === null;
        $paymentMethod = (string) $request->input('payment_method', InvestmentRecorder::PAYMENT_USDT_WALLET);
        $amountUsd = (string) $request->input('amount_usd');
        $qualifying = RewardPlan::isQualifyingParticipationAmount($amountUsd);

        try {
            $recorder->record(
                $user,
                $amountUsd,
                (int) $request->input('duration_days'),
                $paymentMethod,
            );
        } catch (\InvalidArgumentException $e) {
            return back()->withErrors(['amount_usd' => $e->getMessage()]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        $user->refresh();

        if (! $qualifying) {
            $message = __('Investment recorded ($1–$49). You earn personal ROI; no upline referral income is paid. The amount counts toward leadership team volume.');
        } elseif ($wasFirstParticipation && $user->participation_activated_at !== null) {
            $message = __('Staking activated. Daily rewards run on the platform schedule.');
        } else {
            $message = __('Investment recorded. Daily ROI runs on the platform schedule for your selected plan.');
        }

        return back()->with('status', $message);
    }

    public function unlock(Request $request, Investment $investment, StakeUnlockService $unlockSvc): RedirectResponse
    {
        if ((int) $investment->user_id !== (int) $request->user()->id) {
            abort(403);
        }

        if (config('participation_contract.on_chain.enabled') || \App\Support\BlockchainMode::blockchainOnly()) {
            return back()->withErrors([
                'investment' => __('Stake unlock EMIs are for platform staking. Use on-chain withdraw for smart-contract stakes.'),
            ]);
        }

        try {
            $unlock = $unlockSvc->startUnlock($investment);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->withErrors($e->errors());
        } catch (\RuntimeException $e) {
            return back()->withErrors(['investment' => $e->getMessage()]);
        }

        $firstDue = $unlock->emis->first()?->due_at?->toFormattedDateString();
        $feeWaived = bccomp(number_format((float) $unlock->admin_fee_usd, 2, '.', ''), '0', 2) === 0;

        return back()->with(
            'status',
            $feeWaived
                ? __(
                    'Stake unlock started with no admin fee (Flexible 10+ days). Full principal returns in 3 EMIs (first due :date).',
                    ['date' => $firstDue ?? '—'],
                )
                : __(
                    'Stake unlock started. 10% admin fee taken. Your 90% returns in 3 EMIs of 30% (first due :date). Track dates below.',
                    ['date' => $firstDue ?? '—'],
                ),
        );
    }

    public function compound(Request $request, Investment $investment, CompoundStakeService $compoundSvc): RedirectResponse
    {
        if ((int) $investment->user_id !== (int) $request->user()->id) {
            abort(403);
        }

        if (config('participation_contract.on_chain.enabled') || \App\Support\BlockchainMode::blockchainOnly()) {
            return back()->withErrors([
                'investment' => __('Compounding is for platform staking only.'),
            ]);
        }

        try {
            $amount = $compoundSvc->compound($investment);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->withErrors($e->errors());
        } catch (\RuntimeException $e) {
            return back()->withErrors(['investment' => $e->getMessage()]);
        }

        return back()->with(
            'status',
            __('Compounded :amount into your stake. Tomorrow’s daily reward uses the higher principal.', [
                'amount' => '$'.$amount,
            ]),
        );
    }

    public function claimIncome(Request $request, IncomeClaimService $claimSvc): RedirectResponse
    {
        if (config('participation_contract.on_chain.enabled') || \App\Support\BlockchainMode::blockchainOnly()) {
            return back()->withErrors([
                'claim' => __('Use on-chain claim for smart-contract staking rewards.'),
            ]);
        }

        try {
            $result = $claimSvc->claimAccruedIncome($request->user());
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->withErrors($e->errors());
        }

        return back()->with(
            'status',
            __('Claimed :amount to your virtual income balance (no Admin Fee). Withdrawal fees apply only when funds leave the platform.', [
                'amount' => '$'.number_format((float) $result['claimed_usd'], 2),
            ]),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function investmentPageProps(Request $request): array
    {
        $growth = RewardPlan::builtForGrowth();
        $user = $request->user();
        $stakeRead = app(CommunityEngineStakeReadService::class);
        $activation = app(MemberActivationService::class);
        $walletBalance = app(WalletBalanceService::class)->currentBalance($user);
        $raceCoin = app(RaceCoinService::class);
        $unlockSvc = app(StakeUnlockService::class);
        $compoundSvc = app(CompoundStakeService::class);
        $accrualSvc = app(IncomeAccrualService::class);
        $unlockRules = RewardPlan::stakeUnlockRules();
        $compoundingEnabled = RewardPlan::compoundingEnabled()
            && ! config('participation_contract.on_chain.enabled')
            && ! \App\Support\BlockchainMode::blockchainOnly();

        $investmentRows = Investment::query()
            ->with(['stakeUnlock.emis'])
            ->where('user_id', $request->user()->id)
            ->latest('id')
            ->limit(20)
            ->get([
                'id',
                'amount_usd',
                'duration_days',
                'roi_percent_monthly',
                'roi_percent_daily',
                'roi_payouts_done',
                'total_roi_paid_usd',
                'cap_multiplier',
                'status',
                'next_roi_at',
                'created_at',
            ]);

        $compoundableMap = $compoundingEnabled
            ? $compoundSvc->compoundableByInvestment(
                (int) $user->id,
                $investmentRows->pluck('id')->all(),
            )
            : [];

        $accruedMap = $accrualSvc->accruedByInvestment(
            (int) $user->id,
            $investmentRows->pluck('id')->all(),
        );

        $incomePolicy = $accrualSvc->summaryForUser($user, app(WalletBalanceService::class));

        $investments = $investmentRows
            ->map(static function (Investment $inv) use ($unlockSvc, $unlockRules, $compoundingEnabled, $compoundableMap, $accruedMap) {
                $unlock = $inv->stakeUnlock;
                $principal = number_format((float) $inv->amount_usd, 2, '.', '');
                $feePct = RewardPlan::stakeUnlockAdminFeePercentFor($inv);
                $adminFee = bcmul($principal, bcdiv(number_format($feePct, 4, '.', ''), '100', 8), 2);
                $emiPool = bcsub($principal, $adminFee, 2);
                $emiEach = bccomp(number_format($feePct, 4, '.', ''), '0', 4) === 0
                    ? bcdiv($emiPool, (string) max(1, (int) $unlockRules['emi_count']), 2)
                    : bcmul($principal, bcdiv(number_format($unlockRules['emi_percent_each'], 4, '.', ''), '100', 8), 2);
                $compoundable = $compoundableMap[$inv->id] ?? '0.00';
                $accrued = $accruedMap[$inv->id] ?? '0.0000';
                $canCompound = $compoundingEnabled
                    && $inv->status === Investment::STATUS_ACTIVE
                    && bccomp($compoundable, '0.01', 2) >= 0;

                return [
                    'id' => $inv->id,
                    'amount_usd' => $principal,
                    'duration_days' => $inv->duration_days,
                    'roi_percent_monthly' => $inv->roi_percent_monthly,
                    'roi_percent_daily' => $inv->roi_percent_daily,
                    'roi_payouts_done' => $inv->roi_payouts_done,
                    'total_roi_paid_usd' => number_format((float) $inv->total_roi_paid_usd, 2, '.', ''),
                    'cap_multiplier' => $inv->cap_multiplier,
                    'status' => $inv->status,
                    'next_roi_at' => $inv->next_roi_at?->toIso8601String(),
                    'created_at' => $inv->created_at?->toIso8601String(),
                    'holding_completed_at' => $inv->holding_completed_at?->toIso8601String(),
                    'rollover_count' => (int) ($inv->rollover_count ?? 0),
                    'can_unlock' => $unlockSvc->canUnlock($inv),
                    'can_compound' => $canCompound,
                    'compoundable_usd' => $compoundable,
                    'accrued_reward_usd' => $accrued,
                    'unlock_preview' => [
                        'admin_fee_percent' => number_format($feePct, 2, '.', ''),
                        'admin_fee_usd' => $adminFee,
                        'fee_waived' => $feePct <= 0,
                        'emi_usd_each' => $emiEach,
                        'emi_count' => $unlockRules['emi_count'],
                        'interval_days' => $unlockRules['interval_days'],
                    ],
                    'unlock' => $unlock ? [
                        'id' => $unlock->id,
                        'admin_fee_usd' => number_format((float) $unlock->admin_fee_usd, 2, '.', ''),
                        'emi_pool_usd' => number_format((float) $unlock->emi_pool_usd, 2, '.', ''),
                        'status' => $unlock->status,
                        'unlocked_at' => $unlock->unlocked_at?->toIso8601String(),
                        'emis' => $unlock->emis->map(static fn ($emi) => [
                            'emi_number' => $emi->emi_number,
                            'amount_usd' => number_format((float) $emi->amount_usd, 2, '.', ''),
                            'due_at' => $emi->due_at?->toIso8601String(),
                            'paid_at' => $emi->paid_at?->toIso8601String(),
                            'status' => $emi->status,
                        ])->values()->all(),
                    ] : null,
                ];
            })
            ->values()
            ->all();

        return [
            'memberActivation' => $activation->statusFor($user),
            'web3Engine' => BlockchainContractPayload::enginePayload(),
            'onChainParticipation' => BlockchainContractPayload::enginePayload(),
            'blockchainParticipations' => $user->id
                ? \App\Models\BlockchainParticipation::query()
                    ->where('user_id', $user->id)
                    ->latest('id')
                    ->limit(10)
                    ->get(['tx_hash', 'stake_index', 'principal_usdt', 'lock_seconds', 'synced_at'])
                : [],
            'communityEngineStakes' => $user->wallet_address
                ? $stakeRead->stakesForUser($user)
                : [],
            'builtForGrowth' => [
                'min_amount_usd' => number_format((float) ($growth['min_amount_usd'] ?? 1), 2, '.', ''),
                'qualifying_amount_usd' => number_format((float) ($growth['qualifying_amount_usd'] ?? 50), 2, '.', ''),
                'max_amount_usd' => number_format((float) ($growth['max_amount_usd'] ?? 999_999_999.99), 2, '.', ''),
                'duration_tiers' => RewardPlan::builtForGrowthDurationTiersForUi(),
                'duration_options' => RewardPlan::builtForGrowthDurationOptionsForUi(),
                'stake_withdraw_fee_percent' => number_format(RewardPlan::stakeWithdrawFeePercent(), 2, '.', ''),
                'stake_unlock' => [
                    'admin_fee_percent' => number_format($unlockRules['admin_fee_percent'], 2, '.', ''),
                    'emi_count' => $unlockRules['emi_count'],
                    'emi_percent_each' => number_format($unlockRules['emi_percent_each'], 2, '.', ''),
                    'interval_days' => $unlockRules['interval_days'],
                    'flexible_fee_free_after_days' => $unlockRules['flexible_fee_free_after_days'],
                ],
                'holding_rollover' => [
                    'enabled' => RewardPlan::holdingRolloverEnabled(),
                    'hours' => RewardPlan::holdingRolloverHours(),
                ],
            ],
            'compounding' => [
                'enabled' => $compoundingEnabled,
            ],
            'investments' => $investments,
            'stake_unlocks' => $unlockSvc->schedulePayloadForUser((int) $user->id),
            'wallet_balance_usd' => $walletBalance,
            'income_policy' => $incomePolicy,
            'race_coin_balance' => $raceCoin->currentBalance($user),
            'race_coin_price_usd' => number_format($raceCoin->priceUsd(), 2, '.', ''),
            'on_chain_sponsor_wallet' => OnChainReferrer::sponsorWalletFor($user),
        ];
    }
}
