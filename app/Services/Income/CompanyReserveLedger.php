<?php

namespace App\Services\Income;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Internal user row used only to hold company-side reserve credits in ledger / balance.
 */
final class CompanyReserveLedger
{
    public function user(): User
    {
        $email = strtolower(trim((string) config('income.company_ledger_email', 'company-ledger@rynexcapital.internal')));

        return User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => 'Company reserve',
                'password' => Hash::make(Str::random(48)),
                'email_verified_at' => now(),
                'is_blocked' => true,
            ],
        );
    }
}
