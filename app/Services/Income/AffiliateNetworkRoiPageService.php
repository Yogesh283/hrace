<?php

namespace App\Services\Income;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\MemberCode;
use App\Support\RewardPlan;

class AffiliateNetworkRoiPageService
{
    /**
     * @return array<string, mixed>
     */
    public function pagePropsFor(User $user): array
    {
        $uid = $user->id;
        $pct = RewardPlan::roiSharingDirectPercent();

        $directCount = (int) User::query()
            ->where('referred_by', $uid)
            ->whereNotNull('participation_activated_at')
            ->count();

        $entries = LedgerEntry::query()
            ->production()
            ->where('user_id', $uid)
            ->where('entry_type', LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI)
            ->where('amount_usd', '>', 0)
            ->latest('id')
            ->get(['amount_usd', 'meta', 'created_at', 'reference_id']);

        $lifetime = 0.0;
        $paymentCount = 0;
        foreach ($entries as $row) {
            $lifetime += (float) $row->amount_usd;
            $paymentCount++;
        }

        $fromUserIds = [];
        foreach ($entries->take(20) as $row) {
            $meta = is_array($row->meta) ? $row->meta : [];
            if (! empty($meta['from_user_id'])) {
                $fromUserIds[] = (int) $meta['from_user_id'];
            }
        }
        $fromUserIds = array_values(array_unique($fromUserIds));
        $memberCodes = $fromUserIds === []
            ? []
            : User::query()
                ->whereIn('id', $fromUserIds)
                ->get(['id', 'member_number'])
                ->mapWithKeys(static fn (User $u) => [
                    $u->id => MemberCode::format($u->member_number),
                ])
                ->all();

        $levels = [
            [
                'level' => 1,
                'roi_of_roi_percent' => number_format($pct, 2, '.', ''),
                'referral_required' => 0,
                'referral_label' => 'Unlimited directs',
                'direct_active_met' => true,
                'your_direct_actives' => $directCount,
                'earned_usd' => number_format($lifetime, 4, '.', ''),
                'payment_count' => $paymentCount,
                'has_earned' => $lifetime > 0,
            ],
        ];

        $recent = $entries->take(15)->map(static function (LedgerEntry $row) use ($memberCodes) {
            $meta = is_array($row->meta) ? $row->meta : [];
            $fromId = (int) ($meta['from_user_id'] ?? 0);

            return [
                'level' => 1,
                'percent' => $meta['percent'] ?? null,
                'amount_usd' => $row->amount_usd,
                'from_member_code' => $fromId > 0 ? ($memberCodes[$fromId] ?? null) : null,
                'at' => $row->created_at?->toIso8601String(),
            ];
        })->values()->all();

        return [
            'program_name' => 'ROI Sharing Framework',
            'direct_active_count' => $directCount,
            'lifetime_earned_usd' => number_format($lifetime, 4, '.', ''),
            'trigger_note' => 'Level 1 (direct) only: up to '.$pct.'% of each direct’s daily staking ROI. Unlimited directs. Paid with the daily income:pay-roi cron.',
            'levels' => $levels,
            'recent_payouts' => $recent,
        ];
    }
}
