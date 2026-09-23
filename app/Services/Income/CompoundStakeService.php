<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\UserWallet;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CompoundStakeService
{
    public function __construct(
        protected LedgerWriter $ledger,
        protected WalletBalanceService $walletBalance,
    ) {}

    /**
     * Reinvest uncompounded daily ROI from wallet back into the same stake principal.
     */
    public function compound(Investment $investment, ?string $amountUsd = null): string
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        if (! RewardPlan::compoundingEnabled()) {
            throw ValidationException::withMessages([
                'investment' => __('Compounding is not enabled.'),
            ]);
        }

        return DB::transaction(function () use ($investment, $amountUsd) {
            $inv = Investment::query()->whereKey($investment->id)->lockForUpdate()->firstOrFail();
            $user = User::query()->whereKey($inv->user_id)->lockForUpdate()->firstOrFail();

            if ($inv->status !== Investment::STATUS_ACTIVE) {
                throw ValidationException::withMessages([
                    'investment' => __('Only active stakes can be compounded.'),
                ]);
            }

            if ($user->is_blocked) {
                throw ValidationException::withMessages([
                    'investment' => __('Account is blocked.'),
                ]);
            }

            $available = $this->compoundableUsd($user->id, $inv->id);
            if (bccomp($available, '0.01', 2) < 0) {
                throw ValidationException::withMessages([
                    'investment' => __('No daily reward available to compound. Earn ROI first, then compound.'),
                ]);
            }

            $amount = $amountUsd !== null && $amountUsd !== ''
                ? number_format((float) $amountUsd, 2, '.', '')
                : $available;

            if (bccomp($amount, '0.01', 2) < 0) {
                throw ValidationException::withMessages([
                    'amount' => __('Compound amount must be at least $0.01.'),
                ]);
            }

            if (bccomp($amount, $available, 2) > 0) {
                throw ValidationException::withMessages([
                    'amount' => __('Compound amount exceeds available daily rewards (:available).', [
                        'available' => $available,
                    ]),
                ]);
            }

            UserWallet::query()->firstOrCreate(
                ['user_id' => $user->id],
                ['balance_usd' => $user->balance_usd ?? 0],
            );
            $walletRow = UserWallet::query()->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            $wallet = number_format((float) $walletRow->balance_usd, 2, '.', '');
            if (bccomp($amount, $wallet, 2) > 0) {
                throw ValidationException::withMessages([
                    'amount' => __('Insufficient wallet balance to compound.'),
                ]);
            }

            $this->ledger->record(
                $user,
                LedgerEntry::TYPE_COMPOUND_REINVEST,
                bcmul($amount, '-1', 2),
                'investment',
                $inv->id,
                [
                    'compound' => true,
                    'principal_before_usd' => number_format((float) $inv->amount_usd, 2, '.', ''),
                    'compounded_usd' => $amount,
                ],
            );

            $newPrincipal = bcadd(number_format((float) $inv->amount_usd, 2, '.', ''), $amount, 2);
            $inv->forceFill(['amount_usd' => $newPrincipal])->save();

            if (! $user->compound_rewards_enabled) {
                $user->forceFill(['compound_rewards_enabled' => true])->save();
            }

            return $amount;
        });
    }

    /**
     * Uncompounded ROI for this stake, capped by current wallet balance.
     */
    public function compoundableUsd(int $userId, int $investmentId): string
    {
        $roiEarned = LedgerEntry::query()
            ->where('user_id', $userId)
            ->whereIn('entry_type', [
                LedgerEntry::TYPE_ROI_DAILY,
                LedgerEntry::TYPE_INCOME_CLAIM,
            ])
            ->where('reference_type', 'investment')
            ->where('reference_id', $investmentId)
            ->sum('amount_usd');

        $alreadyCompounded = LedgerEntry::query()
            ->where('user_id', $userId)
            ->where('entry_type', LedgerEntry::TYPE_COMPOUND_REINVEST)
            ->where('reference_type', 'investment')
            ->where('reference_id', $investmentId)
            ->sum('amount_usd');

        // compound_reinvest amounts are negative; abs of sum = compounded total
        $compoundedAbs = number_format(abs((float) $alreadyCompounded), 2, '.', '');
        $earned = number_format((float) $roiEarned, 2, '.', '');
        $uncompounded = bcsub($earned, $compoundedAbs, 2);
        if (bccomp($uncompounded, '0', 2) < 0) {
            $uncompounded = '0.00';
        }

        $user = User::query()->find($userId);
        if (! $user) {
            return '0.00';
        }

        $wallet = number_format((float) $this->walletBalance->virtualIncomeBalance($user), 2, '.', '');

        return bccomp($uncompounded, $wallet, 2) <= 0 ? $uncompounded : $wallet;
    }

    /**
     * @param  list<int>  $investmentIds
     * @return array<int, string> investment_id => compoundable_usd
     */
    public function compoundableByInvestment(int $userId, array $investmentIds): array
    {
        $out = [];
        foreach ($investmentIds as $id) {
            $out[(int) $id] = $this->compoundableUsd($userId, (int) $id);
        }

        return $out;
    }
}
