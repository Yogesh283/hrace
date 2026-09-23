<?php

namespace App\Services\Income;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\RewardPlan;

class AffiliatePlacementService
{
    public function __construct(
        protected LedgerWriter $ledger,
        protected ReferralTree $tree,
    ) {}

    /**
     * Per new referral (diagram): direct sponsor gets $1, grandparent gets $5.
     * Example tree A → B,C → D,E under B: A receives 1+1 from B,C and 5+5 from D,E.
     *
     * Run inside the same DB transaction as the new referral user insert.
     */
    public function onNewReferralRegistration(User $newUser): void
    {
        if (! RewardPlan::affiliatePlacementEnabled()) {
            return;
        }

        if (! $newUser->referred_by) {
            return;
        }

        $cfg = RewardPlan::affiliatePlacement();
        $directUsd = number_format((float) ($cfg['direct_sponsor_usd'] ?? 1), 2, '.', '');
        $grandUsd = number_format((float) ($cfg['grandparent_usd'] ?? 5), 2, '.', '');

        $sponsor = User::query()->whereKey($newUser->referred_by)->lockForUpdate()->first();
        if (! $sponsor) {
            return;
        }

        if ($this->tree->qualifiesForNetworkLevelPayout($sponsor, 1) && bccomp($directUsd, '0', 2) > 0) {
            $this->ledger->record(
                $sponsor,
                LedgerEntry::TYPE_AFFILIATE_PLACEMENT,
                $directUsd,
                'affiliate_placement',
                $newUser->id,
                [
                    'placement_tier' => 'direct_sponsor',
                    'level' => 1,
                    'from_user_id' => $newUser->id,
                    'sponsor_user_id' => $sponsor->id,
                ],
            );
        }

        $grandparent = $sponsor->referred_by
            ? User::query()->whereKey($sponsor->referred_by)->lockForUpdate()->first()
            : null;

        if ($grandparent && $this->tree->qualifiesForNetworkLevelPayout($grandparent, 2) && bccomp($grandUsd, '0', 2) > 0) {
            $this->ledger->record(
                $grandparent,
                LedgerEntry::TYPE_AFFILIATE_PLACEMENT,
                $grandUsd,
                'affiliate_placement',
                $newUser->id,
                [
                    'placement_tier' => 'grandparent',
                    'level' => 2,
                    'from_user_id' => $newUser->id,
                    'sponsor_user_id' => $sponsor->id,
                ],
            );
        }
    }
}
