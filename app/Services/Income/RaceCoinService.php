<?php

namespace App\Services\Income;

use App\Models\RaceCoinSwap;
use App\Models\User;
use App\Models\UserWallet;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;

class RaceCoinService
{
    public function priceUsd(): float
    {
        return (float) config('race_coin.price_usd', 0.10);
    }

    public function coinsForUsdt(float $usdtAmount): string
    {
        $price = $this->priceUsd();
        if ($price <= 0) {
            return '0.0000';
        }

        return number_format($usdtAmount / $price, 4, '.', '');
    }

    public function usdForCoins(float $coins): string
    {
        return number_format($coins * $this->priceUsd(), 2, '.', '');
    }

    public function idActivationCoinsRequired(): string
    {
        $usd = (float) config('race_coin.id_activation_usd', RewardPlan::builtForGrowth()['min_amount_usd'] ?? 50);

        return $this->coinsForUsdt($usd);
    }

    public function currentBalance(User $user): string
    {
        $user->loadMissing('userWallet');

        return number_format((float) ($user->userWallet?->race_coin_balance ?? 0), 4, '.', '');
    }

    public function currentBalanceFloat(User $user): float
    {
        return (float) $this->currentBalance($user);
    }

    public function creditFromSwap(User $user, float $usdtAmount, string $txHash): RaceCoinSwap
    {
        $coins = $this->coinsForUsdt($usdtAmount);
        $usdtStr = number_format($usdtAmount, 2, '.', '');

        return DB::transaction(function () use ($user, $usdtStr, $coins, $txHash) {
            $wallet = $this->lockWallet($user);
            $newBalance = bcadd((string) $wallet->race_coin_balance, $coins, 4);

            $wallet->forceFill(['race_coin_balance' => $newBalance])->save();

            return RaceCoinSwap::query()->create([
                'user_id' => $user->id,
                'swap_type' => RaceCoinSwap::TYPE_SWAP_CREDIT,
                'usdt_amount' => $usdtStr,
                'coins_amount' => $coins,
                'balance_after_coins' => $newBalance,
                'tx_hash' => strtolower($txHash),
                'meta' => [
                    'price_usd' => $this->priceUsd(),
                    'method' => 'web3_usdt',
                ],
            ]);
        });
    }

    public function debitForInvestment(User $user, string $amountUsd, int $investmentId): void
    {
        $coins = $this->coinsForUsdt((float) $amountUsd);
        $amountStr = number_format((float) $amountUsd, 2, '.', '');

        $wallet = $this->lockWallet($user);
        $balance = number_format((float) $wallet->race_coin_balance, 4, '.', '');

        if (bccomp($balance, $coins, 4) < 0) {
            throw new \InvalidArgumentException(
                __('Insufficient Race Coin balance. You need :coins RC for this investment.', [
                    'coins' => $coins,
                ]),
            );
        }

        $newBalance = bcsub($balance, $coins, 4);
        $wallet->forceFill(['race_coin_balance' => $newBalance])->save();

        RaceCoinSwap::query()->create([
            'user_id' => $user->id,
            'swap_type' => RaceCoinSwap::TYPE_INVESTMENT_DEBIT,
            'usdt_amount' => $amountStr,
            'coins_amount' => '-'.$coins,
            'balance_after_coins' => $newBalance,
            'tx_hash' => null,
            'meta' => [
                'price_usd' => $this->priceUsd(),
                'investment_id' => $investmentId,
            ],
        ]);
    }

    public function activateIdWithCoins(User $user): void
    {
        if ($user->id_activated_at !== null) {
            throw new \InvalidArgumentException(__('Your member ID is already active.'));
        }

        $required = $this->idActivationCoinsRequired();

        DB::transaction(function () use ($user, $required) {
            $wallet = $this->lockWallet($user);
            $balance = number_format((float) $wallet->race_coin_balance, 4, '.', '');

            if (bccomp($balance, $required, 4) < 0) {
                throw new \InvalidArgumentException(
                    __('Insufficient Race Coin balance. You need :coins coins to activate your ID.', [
                        'coins' => $required,
                    ]),
                );
            }

            $newBalance = bcsub($balance, $required, 4);
            $wallet->forceFill(['race_coin_balance' => $newBalance])->save();

            RaceCoinSwap::query()->create([
                'user_id' => $user->id,
                'swap_type' => RaceCoinSwap::TYPE_ACTIVATION_DEBIT,
                'usdt_amount' => $this->usdForCoins((float) $required),
                'coins_amount' => '-'.$required,
                'balance_after_coins' => $newBalance,
                'tx_hash' => null,
                'meta' => [
                    'price_usd' => $this->priceUsd(),
                    'activation' => true,
                ],
            ]);

            $user->forceFill(['id_activated_at' => now()])->save();
        });
    }

    private function lockWallet(User $user): UserWallet
    {
        return UserWallet::query()
            ->where('user_id', $user->id)
            ->lockForUpdate()
            ->firstOrFail();
    }
}
