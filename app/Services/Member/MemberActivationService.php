<?php

namespace App\Services\Member;

use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * RACE Community Rewards — activation ladder:
 * 1) Register → can access dashboard and participate
 * 2) $1+ Participation → personal ROI + leadership volume
 * 3) $50+ Participation → full program and referral incomes
 */
class MemberActivationService
{
    public function hasParticipation(User $user): bool
    {
        return $user->participation_activated_at !== null;
    }

    public function isMemberActive(User $user): bool
    {
        return ! $user->is_blocked;
    }

    public function canEarnParticipationIncome(User $user): bool
    {
        return $this->hasParticipation($user) && ! $user->is_blocked;
    }

    public function assertCanPurchaseParticipation(User $user): void
    {
        if ($user->is_blocked) {
            throw ValidationException::withMessages([
                'participation' => __('Your account is blocked and cannot participate.'),
            ]);
        }
    }

    /**
     * Display-only dashboard state. Does not change payout gates.
     *
     * Member ID and Member Status follow the same program activation as staking
     * ($50+ participation, or an explicit id_activated_at). A registered but
     * non-blocked account is NOT shown as Active / Full program.
     *
     * @return array<string, mixed>
     */
    public function statusFor(User $user): array
    {
        $blocked = (bool) $user->is_blocked;
        $participating = $this->hasParticipation($user);
        $idRecorded = $user->id_activated_at !== null;
        $idActive = ! $blocked && ($idRecorded || $participating);
        $memberActive = $idActive;

        return [
            'member_status' => $memberActive ? 'active' : 'inactive',
            'member_status_label' => $memberActive ? __('Active') : __('Inactive'),
            'id_status' => $idActive ? 'active' : 'pending',
            'id_status_label' => $idActive ? __('Activated') : __('Pending'),
            'id_activated_at' => $user->id_activated_at?->toIso8601String(),
            'participation_status' => $participating ? 'active' : 'inactive',
            'participation_status_label' => $participating ? __('Active') : __('Inactive'),
            'participation_activated_at' => $user->participation_activated_at?->toIso8601String(),
            'income_eligibility' => $blocked
                ? 'disabled'
                : ($participating ? 'full' : 'participation_pending'),
            'income_eligibility_label' => match (true) {
                $blocked => __('Disabled — account blocked'),
                ! $participating => __('Add $50+ staking for full program incomes'),
                default => __('Full program enabled'),
            },
            'can_purchase_participation' => ! $blocked && ! $participating,
            'next_step' => match (true) {
                $blocked => 'none',
                ! $participating => 'participation',
                default => 'none',
            },
        ];
    }
}
