<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\User;
use App\Support\RewardPlan;
use Illuminate\Support\Collection;

class BonzaRankService
{
    /**
     * @return array{
     *     required_qualified_directs: int,
     *     direct_activate_within_days: int,
     *     direct_monthly_bonus_percent: float,
     *     days_per_month: int
     * }
     */
    public function config(): array
    {
        return RewardPlan::bonzaRank();
    }

    /**
     * Principal of the member's first investment (activation hold).
     */
    public function activationHoldUsd(User $user): ?string
    {
        if ($user->id_activated_at === null) {
            return null;
        }

        $amount = Investment::query()
            ->where('user_id', $user->id)
            ->orderBy('id')
            ->value('amount_usd');

        if ($amount === null) {
            return null;
        }

        return number_format((float) $amount, 2, '.', '');
    }

    /**
     * Direct referrals who activated within N days of the sponsor's activation
     * with hold amount ≥ sponsor's activation hold.
     *
     * @return Collection<int, User>
     */
    public function qualifyingDirects(User $sponsor): Collection
    {
        if ($sponsor->id_activated_at === null) {
            return collect();
        }

        $sponsorHold = $this->activationHoldUsd($sponsor);
        if ($sponsorHold === null) {
            return collect();
        }

        $windowDays = (int) ($this->config()['direct_activate_within_days']
            ?? $this->config()['direct_invest_within_days']
            ?? 7);

        $windowEnd = $sponsor->id_activated_at->copy()->addDays($windowDays);

        return User::query()
            ->where('referred_by', $sponsor->id)
            ->where('is_blocked', false)
            ->whereNotNull('id_activated_at')
            ->where('id_activated_at', '>=', $sponsor->id_activated_at)
            ->where('id_activated_at', '<=', $windowEnd)
            ->orderBy('id')
            ->get()
            ->filter(fn (User $direct) => $this->directQualifies($direct, $sponsor, $sponsorHold))
            ->values();
    }

    public function directQualifies(User $direct, ?User $sponsor = null, ?string $sponsorHold = null): bool
    {
        if ($direct->id_activated_at === null) {
            return false;
        }

        $sponsor ??= $direct->referred_by
            ? User::query()->whereKey($direct->referred_by)->first()
            : null;

        if (! $sponsor || $sponsor->id_activated_at === null) {
            return false;
        }

        $sponsorHold ??= $this->activationHoldUsd($sponsor);
        $directHold = $this->activationHoldUsd($direct);

        if ($sponsorHold === null || $directHold === null) {
            return false;
        }

        if (bccomp($directHold, $sponsorHold, 2) < 0) {
            return false;
        }

        $windowDays = (int) ($this->config()['direct_activate_within_days']
            ?? $this->config()['direct_invest_within_days']
            ?? 7);

        $windowEnd = $sponsor->id_activated_at->copy()->addDays($windowDays);

        return $direct->id_activated_at->gte($sponsor->id_activated_at)
            && $direct->id_activated_at->lte($windowEnd);
    }

    public function sponsorMeetsBonzaRequirements(User $sponsor): bool
    {
        if ($sponsor->is_blocked || $sponsor->id_activated_at === null) {
            return false;
        }

        if ($this->activationHoldUsd($sponsor) === null) {
            return false;
        }

        $required = (int) ($this->config()['required_qualified_directs'] ?? 2);

        return $this->qualifyingDirects($sponsor)->count() >= $required;
    }

    /**
     * Re-evaluate sponsor after a direct (or self) activates / invests.
     */
    public function onInvestmentRecorded(User $investor): void
    {
        if ($investor->referred_by) {
            $sponsor = User::query()->whereKey($investor->referred_by)->first();
            if ($sponsor) {
                $this->tryAwardBonzaRank($sponsor);
            }
        }

        if ($investor->id_activated_at !== null) {
            $this->tryAwardBonzaRank($investor);
        }
    }

    public function tryAwardBonzaRank(User $sponsor): bool
    {
        if ($sponsor->bonza_rank_at !== null) {
            return false;
        }

        if (! $this->sponsorMeetsBonzaRequirements($sponsor)) {
            return false;
        }

        $now = now();
        $sponsor->forceFill([
            'bonza_rank_at' => $now,
            'bonza_direct_bonus_at' => $now,
        ])->save();

        return true;
    }

    public function directHasActiveBonus(User $user): bool
    {
        return $user->bonza_direct_bonus_at !== null;
    }

    public function dailyBonusPercent(): string
    {
        $cfg = $this->config();
        $monthly = (float) ($cfg['direct_monthly_bonus_percent'] ?? 2);
        $days = (int) ($cfg['days_per_month'] ?? 30);
        if ($days <= 0) {
            return '0.0000';
        }

        return number_format($monthly / $days, 6, '.', '');
    }

    /**
     * @return array<string, mixed>
     */
    public function progressForUser(User $user): array
    {
        $cfg = $this->config();
        $activationHold = $this->activationHoldUsd($user);
        $required = (int) ($cfg['required_qualified_directs'] ?? 2);
        $windowDays = (int) ($cfg['direct_activate_within_days']
            ?? $cfg['direct_invest_within_days']
            ?? 7);
        $qualifying = $this->qualifyingDirects($user);

        $directRows = $qualifying->map(fn (User $d) => [
            'id' => $d->id,
            'name' => $d->name,
            'member_code' => $d->member_code,
            'activated_at' => $d->id_activated_at?->toIso8601String(),
            'activation_hold_usd' => $this->activationHoldUsd($d),
        ])->all();

        $windowEndsAt = $user->id_activated_at?->copy()->addDays($windowDays);

        return [
            'program_name' => 'Affiliate Booster',
            'program_subtitle' => 'Bonza Rank (Direct Bonus)',
            'is_bonza' => $user->bonza_rank_at !== null,
            'bonza_rank_at' => $user->bonza_rank_at?->toIso8601String(),
            'has_roi_bonus' => $user->bonza_direct_bonus_at !== null,
            'bonza_direct_bonus_at' => $user->bonza_direct_bonus_at?->toIso8601String(),
            'id_activated_at' => $user->id_activated_at?->toIso8601String(),
            'activation_hold_usd' => $activationHold,
            'is_activated' => $user->id_activated_at !== null,
            'required_directs' => $required,
            'qualified_direct_count' => $qualifying->count(),
            'qualified_directs' => $directRows,
            'direct_window_days' => $windowDays,
            'bonanza_window_ends_at' => $windowEndsAt?->toIso8601String(),
            'direct_monthly_bonus_percent' => (float) ($cfg['direct_monthly_bonus_percent'] ?? 2),
            'sponsor_requirements_met' => $this->sponsorMeetsBonzaRequirements($user),
        ];
    }
}
