<?php

namespace App\Services\Income;

use App\Models\IsuPurchase;
use App\Models\User;
use App\Support\BlockchainMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IsuCoinService
{
    public function __construct(
        protected InvestmentRecorder $recorder,
    ) {}

    public function priceUsd(): float
    {
        return (float) config('isu.price_usd', 0.05);
    }

    public function coinsForUsdt(float $usdtAmount): string
    {
        $price = $this->priceUsd();
        if ($price <= 0) {
            return '0.0000';
        }

        return number_format($usdtAmount / $price, 4, '.', '');
    }

    /**
     * Credit a verified ISU purchase and immediately open a staking position
     * for the full amount — the purchased coins go straight into staking.
     */
    public function purchaseAndStake(User $user, float $verifiedUsd, string $txHash, int $durationDays): IsuPurchase
    {
        if (config('participation_contract.on_chain.enabled') || BlockchainMode::blockchainOnly()) {
            throw ValidationException::withMessages([
                'isu' => __('ISU staking is on-chain only right now. Please contact support.'),
            ]);
        }

        $amountStr = number_format($verifiedUsd, 2, '.', '');
        $coins = $this->coinsForUsdt($verifiedUsd);

        return DB::transaction(function () use ($user, $amountStr, $coins, $txHash, $durationDays) {
            $investment = $this->recorder->record(
                $user,
                $amountStr,
                $durationDays,
                InvestmentRecorder::PAYMENT_ONCHAIN_USDT,
            );

            return IsuPurchase::query()->create([
                'user_id' => $user->id,
                'investment_id' => $investment->id,
                'usdt_amount' => $amountStr,
                'isu_coins_amount' => $coins,
                'price_usd' => number_format($this->priceUsd(), 4, '.', ''),
                'duration_days' => $durationDays,
                'tx_hash' => strtolower($txHash),
                'meta' => [
                    'method' => 'web3_usdt',
                ],
            ]);
        });
    }
}
