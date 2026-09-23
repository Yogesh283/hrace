<?php

namespace App\Services\Income;

use App\Models\User;
use App\Support\RewardPlan;

class AccountActivationService
{
    /**
     * Legacy hook after wallet deposit. Disabled when id_activation.enabled is false.
     */
    public function tryActivateAfterDeposit(User $user): void
    {
        if (! RewardPlan::idActivationEnabled()) {
            return;
        }

        // Kept for optional re-enable; no payouts when level_rewards_usd is empty.
    }
}
