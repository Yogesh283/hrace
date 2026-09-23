<?php

namespace App\Services\Income;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\UserWallet;

class WalletBalanceService
{
    /**
     * Virtual Income Wallet — earned income available for claim/withdraw/compound (authoritative).
     */
    public function virtualIncomeBalance(User $user): string
    {
        return app(VirtualIncomeWalletService::class)->availableBalance($user);
    }

    /**
     * Legacy platform USDT wallet (deposits + ledger sync) — not the Virtual Income Wallet authority.
     */
    public function currentBalance(User $user): string
    {
        $user->loadMissing('userWallet');

        if ($user->userWallet) {
            return number_format((float) $user->userWallet->balance_usd, 2, '.', '');
        }

        $wallet = UserWallet::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['balance_usd' => $user->balance_usd ?? 0],
        );

        return number_format((float) $wallet->balance_usd, 2, '.', '');
    }

    public function currentBalanceFloat(User $user): float
    {
        return (float) $this->currentBalance($user);
    }

    public function recalculateFromLedger(User $user): string
    {
        $sum = (string) (LedgerEntry::query()
            ->where('user_id', $user->id)
            ->production()
            ->whereIn('entry_type', LedgerEntry::walletBalanceEntryTypes())
            ->sum('amount_usd') ?? '0');

        $balance = number_format((float) $sum, 2, '.', '');

        UserWallet::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['balance_usd' => $balance],
        );

        $user->forceFill(['balance_usd' => $balance])->save();

        return $balance;
    }
}
