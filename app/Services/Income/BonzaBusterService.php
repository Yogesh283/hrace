<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\RewardPlan;

class BonzaBusterService
{
    public function __construct(
        protected LedgerWriter $ledger,
    ) {}

    public function isEnabled(): bool
    {
        return (bool) (RewardPlan::bonzaBuster()['enabled'] ?? true);
    }

    /**
     * Pay direct sponsor (level 1) a % of referral's investment principal.
     */
    public function onInvestment(Investment $investment): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $investor = $investment->user;
        if (! $investor?->referred_by) {
            return;
        }

        $sponsor = User::query()->whereKey($investor->referred_by)->first();
        if (! $sponsor || $sponsor->is_blocked) {
            return;
        }

        $pct = RewardPlan::bonzaBusterDirectPercent();
        if ($pct === null || $pct <= 0) {
            return;
        }

        $principal = number_format((float) $investment->amount_usd, 2, '.', '');
        $rate = bcdiv((string) $pct, '100', 6);
        $amount = bcmul($principal, $rate, 2);

        if (bccomp($amount, '0', 2) <= 0) {
            return;
        }

        $this->ledger->record(
            $sponsor,
            LedgerEntry::TYPE_BONZA_BUSTER,
            $amount,
            'investment',
            $investment->id,
            [
                'level' => 1,
                'percent' => $pct,
                'from_user_id' => $investor->id,
                'program' => 'bonza_buster',
            ],
        );
    }
}
