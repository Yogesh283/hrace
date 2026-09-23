<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Services\Member\MemberActivationService;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;

class InvestmentRecorder
{
    public const PAYMENT_USDT_WALLET = 'usdt_wallet';

    public const PAYMENT_RACE_COIN = 'race_coin';

    /** Funds already verified on-chain (e.g. ISU purchase) — never debit the platform wallet balance. */
    public const PAYMENT_ONCHAIN_USDT = 'onchain_usdt';

    public function __construct(
        protected IncomeDispatcher $dispatcher,
        protected RaceCoinService $raceCoin,
        protected MemberActivationService $activation,
    ) {}

    public function record(User $user, string $amountUsd, int $durationDays, string $paymentMethod = self::PAYMENT_USDT_WALLET): Investment
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        $this->activation->assertCanPurchaseParticipation($user);

        $growth = RewardPlan::builtForGrowth();
        $min = number_format((float) ($growth['min_amount_usd'] ?? 1), 2, '.', '');
        $max = number_format((float) ($growth['max_amount_usd'] ?? 999_999_999.99), 2, '.', '');
        $amountStr = number_format((float) $amountUsd, 2, '.', '');

        if (bccomp($amountStr, $min, 2) < 0 || bccomp($amountStr, $max, 2) > 0) {
            throw new \InvalidArgumentException(
                __('Amount must be between :min and :max USD.', ['min' => $min, 'max' => $max]),
            );
        }

        if (! RewardPlan::growthDurationIsAllowed($durationDays)) {
            throw new \InvalidArgumentException(__('Please select a valid staking tier.'));
        }

        if (! in_array($paymentMethod, [self::PAYMENT_USDT_WALLET, self::PAYMENT_RACE_COIN, self::PAYMENT_ONCHAIN_USDT], true)) {
            throw new \InvalidArgumentException(__('Please select a valid payment method.'));
        }

        $qualifying = RewardPlan::isQualifyingParticipationAmount($amountStr);
        $dailyPct = RewardPlan::growthDailyPercentForDuration($durationDays);
        if ($dailyPct === null || $dailyPct <= 0) {
            throw new \InvalidArgumentException(__('Could not calculate daily reward for this tier.'));
        }

        $dailyStr = number_format((float) $dailyPct, 4, '.', '');
        $monthlyStr = number_format((float) $dailyPct * 30, 2, '.', '');

        return DB::transaction(function () use ($user, $amountStr, $durationDays, $dailyStr, $monthlyStr, $paymentMethod, $qualifying) {
            // Only $50+ activates participation (income eligibility).
            if ($qualifying && $user->participation_activated_at === null) {
                $user->forceFill(['participation_activated_at' => now()])->save();
            }

            $investment = Investment::query()->create([
                'user_id' => $user->id,
                'amount_usd' => $amountStr,
                'duration_days' => $durationDays,
                'roi_percent_monthly' => $monthlyStr,
                'roi_percent_daily' => $dailyStr,
                'total_roi_paid_usd' => '0.00',
                'roi_payouts_done' => 0,
                'cap_multiplier' => '1.00',
                'status' => Investment::STATUS_ACTIVE,
                'next_roi_at' => now(),
            ]);

            if ($paymentMethod === self::PAYMENT_RACE_COIN) {
                $this->raceCoin->debitForInvestment($user, $amountStr, $investment->id);
            }

            $this->dispatcher->onNewInvestment($investment, $paymentMethod);

            return $investment->refresh();
        });
    }
}
