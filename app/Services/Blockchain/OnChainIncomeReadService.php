<?php

namespace App\Services\Blockchain;

use App\Models\OnChainIncomeBalance;
use App\Models\User;

/**
 * Read-model balance from indexed RaceIncomeVault state (blockchain wins on drift).
 */
class OnChainIncomeReadService
{
    public function isAuthoritative(): bool
    {
        return (bool) config('income_vault.enabled')
            && (bool) config('income_vault.authoritative_balance')
            && config('income_vault.contract_address') !== '';
    }

    public function balanceForUser(User $user): ?string
    {
        if (! $this->isAuthoritative()) {
            return null;
        }

        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($wallet === '') {
            return '0.0000';
        }

        $row = OnChainIncomeBalance::query()->where('wallet_address', $wallet)->first();
        if (! $row) {
            return '0.0000';
        }

        return number_format((float) $row->balance_amount, 4, '.', '');
    }
}
