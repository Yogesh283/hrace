<?php

namespace App\Services\Ledger;

use App\Models\User;
use App\Models\UserFundTransaction;
use Illuminate\Support\Facades\Schema;

final class UserFundTransactionRecorder
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public function record(
        User $user,
        string $type,
        string $direction,
        ?string $amountUsd = null,
        ?string $amountRace = null,
        ?string $txHash = null,
        ?int $stakeIndex = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $title = null,
        array $meta = [],
    ): ?UserFundTransaction {
        if (! Schema::hasTable('user_fund_transactions')) {
            return null;
        }

        return UserFundTransaction::query()->create([
            'user_id' => $user->id,
            'type' => $type,
            'direction' => $direction,
            'amount_usd' => $amountUsd,
            'amount_race' => $amountRace,
            'tx_hash' => $txHash !== null ? strtolower($txHash) : null,
            'stake_index' => $stakeIndex,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'title' => $title,
            'meta' => $meta === [] ? null : $meta,
        ]);
    }
}
