<?php

namespace App\Support;

use App\Models\User;

/**
 * Laravel referral → on-chain Engine.register(referrer) sponsor wallet.
 */
final class OnChainReferrer
{
    public static function sponsorWalletFor(User $user): ?string
    {
        if ($user->referred_by === null) {
            return null;
        }

        $sponsor = User::query()->find($user->referred_by);
        if ($sponsor === null) {
            return null;
        }

        $wallet = strtolower(trim((string) ($sponsor->wallet_address ?? '')));
        if (! preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
            return null;
        }

        $self = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($self !== '' && $wallet === $self) {
            return null;
        }

        return $wallet;
    }
}
