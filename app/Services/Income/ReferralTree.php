<?php

namespace App\Services\Income;

use App\Models\Investment;
use App\Models\User;
use App\Support\MemberCode;

class ReferralTree
{
    /**
     * Community referral / team UI network depth (L1–L10).
     * Leadership / generation team volume uses unlimited depth (see allReferralDescendantIds).
     */
    public const NETWORK_MAX_LEVEL = 10;

    /** Safety cap for unlimited tree walks (prevents runaway loops). */
    public const UNLIMITED_DEPTH_SAFETY_CAP = 10_000;

    /**
     * Direct referrals who completed Participation ($50+).
     */
    public function participationDirectCount(int $leaderId): int
    {
        return (int) User::query()
            ->where('referred_by', $leaderId)
            ->whereNotNull('participation_activated_at')
            ->count();
    }

    /**
     * @deprecated Use participationDirectCount() for participation incomes.
     */
    public function activatedDirectCount(int $leaderId): int
    {
        return $this->participationDirectCount($leaderId);
    }

    /**
     * Participation program L1–L10: earn when self is $50+ active (not blocked).
     * No N-activated-directs gate — depth alone is enough.
     */
    public function qualifiesForParticipationLevelPayout(User $recipient, int $networkLevel): bool
    {
        if ($recipient->is_blocked || $networkLevel < 1 || $recipient->participation_activated_at === null) {
            return false;
        }

        return true;
    }

    /**
     * Community Team Rewards (withdrawal 10%): Level N requires N $50+ activated directs.
     * L1 = 1 direct, L2 = 2, … L10 = 10. Otherwise that level is unpaid (share → admin).
     */
    public function qualifiesForTeamRewardLevelPayout(User $recipient, int $networkLevel): bool
    {
        if (! $this->qualifiesForParticipationLevelPayout($recipient, $networkLevel)) {
            return false;
        }

        return $this->participationDirectCount($recipient->id) >= $networkLevel;
    }

    /**
     * @deprecated Use qualifiesForParticipationLevelPayout().
     */
    public function qualifiesForNetworkLevelPayout(User $recipient, int $networkLevel): bool
    {
        return $this->qualifiesForParticipationLevelPayout($recipient, $networkLevel);
    }

    /**
     * Referral downline user IDs up to network level N (default L1–L10 for community referral UI).
     * Pass null for unlimited depth (generation / leadership volume).
     *
     * @return list<int>
     */
    public function referralDescendantIds(int $leaderId, ?int $maxLevel = self::NETWORK_MAX_LEVEL): array
    {
        if ($maxLevel === null) {
            return $this->allReferralDescendantIds($leaderId);
        }

        $maxLevel = $this->normalizeNetworkMaxLevel($maxLevel);

        return $this->walkDescendantIds($leaderId, $maxLevel);
    }

    /**
     * Full referral downline — unlimited depth (generation / leadership team volume).
     *
     * @return list<int>
     */
    public function allReferralDescendantIds(int $leaderId): array
    {
        return $this->walkDescendantIds($leaderId, self::UNLIMITED_DEPTH_SAFETY_CAP);
    }

    public function referralDescendantCount(int $leaderId, ?int $maxLevel = self::NETWORK_MAX_LEVEL): int
    {
        return count($this->referralDescendantIds($leaderId, $maxLevel));
    }

    private function normalizeNetworkMaxLevel(int $maxLevel): int
    {
        return max(1, min(self::NETWORK_MAX_LEVEL, $maxLevel));
    }

    /**
     * @return list<int>
     */
    private function walkDescendantIds(int $leaderId, int $maxDepth): array
    {
        $out = [];
        $frontier = [$leaderId];
        $seen = [$leaderId => true];

        for ($depth = 1; $depth <= $maxDepth; $depth++) {
            if ($frontier === []) {
                break;
            }

            $children = User::query()
                ->whereIn('referred_by', $frontier)
                ->pluck('id')
                ->map(static fn ($id) => (int) $id)
                ->all();

            $next = [];
            foreach ($children as $cid) {
                if (isset($seen[$cid])) {
                    continue;
                }
                $seen[$cid] = true;
                $out[] = $cid;
                $next[] = $cid;
            }

            $frontier = $next;
        }

        return $out;
    }

    /**
     * Team investment volume = leader + downline (L1–L10 by default).
     */
    public function teamInvestmentVolumeUsd(int $leaderId, bool $unlimitedDepth = false): string
    {
        $ids = $unlimitedDepth
            ? $this->allReferralDescendantIds($leaderId)
            : $this->referralDescendantIds($leaderId);
        $ids[] = $leaderId;

        $sum = Investment::query()
            ->whereIn('user_id', $ids)
            ->sum('amount_usd');

        return number_format((float) $sum, 2, '.', '');
    }

    /**
     * Referral downline only (excludes the leader).
     * L1–L10 by default; set $unlimitedDepth for generation / leadership volume.
     */
    public function downlineInvestmentVolumeUsd(int $leaderId, bool $unlimitedDepth = false): string
    {
        $ids = $unlimitedDepth
            ? $this->allReferralDescendantIds($leaderId)
            : $this->referralDescendantIds($leaderId);
        if ($ids === []) {
            return '0.00';
        }

        $sum = Investment::query()
            ->whereIn('user_id', $ids)
            ->sum('amount_usd');

        return number_format((float) $sum, 2, '.', '');
    }

    /**
     * Investment volume from members at exactly one network depth (level 1 = directs, … level 10).
     */
    public function downlineInvestmentVolumeUsdAtLevel(int $leaderId, int $level): string
    {
        $level = max(1, min(self::NETWORK_MAX_LEVEL, $level));
        $parentIds = [$leaderId];

        for ($depth = 1; $depth <= $level; $depth++) {
            if ($parentIds === []) {
                return '0.00';
            }

            $memberIds = User::query()
                ->whereIn('referred_by', $parentIds)
                ->pluck('id')
                ->map(static fn ($id) => (int) $id)
                ->all();

            if ($depth === $level) {
                if ($memberIds === []) {
                    return '0.00';
                }

                $sum = Investment::query()
                    ->whereIn('user_id', $memberIds)
                    ->sum('amount_usd');

                return number_format((float) $sum, 2, '.', '');
            }

            $parentIds = $memberIds;
        }

        return '0.00';
    }

    /**
     * @return list<User>
     */
    public function uplinesByReferral(User $from, int $maxDepth = 100): array
    {
        $out = [];
        $current = $from;
        $depth = 0;

        while ($current->referred_by && $depth < $maxDepth) {
            $parent = User::query()->find($current->referred_by);
            if (! $parent) {
                break;
            }
            $out[] = $parent;
            $current = $parent;
            $depth++;
        }

        return $out;
    }

    /**
     * Referral downline grouped by network depth (level 1 = directs … level 10).
     *
     * @return list<array{level: int, count: int, members: list<array<string, mixed>>}>
     */
    public function referralLevelsForLeader(int $leaderId, int $maxLevel = self::NETWORK_MAX_LEVEL): array
    {
        $maxLevel = $this->normalizeNetworkMaxLevel($maxLevel);
        $parentIds = [$leaderId];
        $out = [];

        for ($depth = 1; $depth <= $maxLevel; $depth++) {
            if ($parentIds === []) {
                $out[] = [
                    'level' => $depth,
                    'count' => 0,
                    'members' => [],
                ];

                continue;
            }

            $rows = User::query()
                ->whereIn('referred_by', $parentIds)
                ->withSum('investments as invested_usd', 'amount_usd')
                ->orderByDesc('id')
                ->get([
                    'id',
                    'member_number',
                    'name',
                    'referral_code',
                    'is_blocked',
                    'id_activated_at',
                    'created_at',
                ]);

            $members = $rows->map(static function (User $member) use ($depth) {
                return [
                    'id' => $member->id,
                    'network_level' => $depth,
                    'member_number' => $member->member_number,
                    'member_code' => MemberCode::format($member->member_number),
                    'name' => $member->name,
                    'referral_code' => $member->referral_code,
                    'is_blocked' => (bool) $member->is_blocked,
                    'id_active' => $member->id_activated_at !== null,
                    'joined_at' => $member->created_at?->toIso8601String(),
                    'invested_usd' => number_format((float) ($member->invested_usd ?? 0), 2, '.', ''),
                ];
            })->values()->all();

            $out[] = [
                'level' => $depth,
                'count' => count($members),
                'members' => $members,
            ];

            $parentIds = $rows->pluck('id')->map(static fn ($id) => (int) $id)->all();
        }

        return $out;
    }
}
