<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\UserWallet;
use App\Support\RewardPlan;

class IncomeDispatcher
{
    public function __construct(
        protected LedgerWriter $ledger,
        protected ReferralTree $tree,
    ) {}

    public function onNewInvestment(Investment $investment, string $paymentMethod = InvestmentRecorder::PAYMENT_USDT_WALLET): void
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        $investor = $investment->user;
        $principal = (string) $investment->amount_usd;

        if (
            $paymentMethod === InvestmentRecorder::PAYMENT_USDT_WALLET
            && config('income.deduct_investment_from_balance', false)
        ) {
            $neg = bcmul($principal, '-1', 2);
            $wallet = UserWallet::query()->firstOrCreate(
                ['user_id' => $investor->id],
                ['balance_usd' => $investor->balance_usd],
            );
            if (bccomp((string) $wallet->balance_usd, $principal, 2) < 0) {
                throw new \InvalidArgumentException(__('Insufficient balance for this investment.'));
            }
            $this->ledger->record(
                $investor,
                LedgerEntry::TYPE_INVESTMENT_DEBIT,
                $neg,
                'investment',
                $investment->id,
                ['note' => 'Principal allocation'],
            );
        }

        // $1–$49 earns personal ROI and leadership volume only; no community referral payouts.
        if (! RewardPlan::isQualifyingParticipationAmount($principal)) {
            return;
        }

        $this->payCommunityReferrals($investor, $principal, $investment->id);
    }

    private function payCommunityReferrals(User $investor, string $principal, int $investmentId): void
    {
        $investor = User::query()->findOrFail($investor->id);
        $ancestor = $investor->referred_by ? User::query()->find($investor->referred_by) : null;
        $depth = 1;

        while ($ancestor && $depth <= 10) {
            $pct = RewardPlan::communityReferralPercentForLevel($depth);
            if ($pct !== null && $pct > 0 && $this->canPayReferralAtDepth($investor, $ancestor, $depth)) {
                $rate = bcdiv((string) $pct, '100', 6);
                $amount = bcmul($principal, $rate, 2);
                if (bccomp($amount, '0', 2) > 0) {
                    $this->ledger->record(
                        $ancestor,
                        LedgerEntry::TYPE_COMMUNITY_REFERRAL,
                        $amount,
                        'investment',
                        $investmentId,
                        ['level' => $depth, 'percent' => $pct, 'from_user_id' => $investor->id],
                    );
                }
            }

            $ancestor = $ancestor->referred_by ? User::query()->find($ancestor->referred_by) : null;
            $depth++;
        }
    }

    private function canPayReferralAtDepth(User $investor, User $ancestor, int $depth): bool
    {
        return $this->tree->qualifiesForParticipationLevelPayout($ancestor, $depth);
    }
}
