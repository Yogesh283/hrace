<?php

namespace App\Services\Income;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\RewardPlan;

/**
 * ROI Sharing Framework: Level-1 (direct) only — up to 10% of a direct's staking ROI.
 * Unlimited directs. Triggered from income:pay-roi after each daily/monthly ROI credit.
 */
class AffiliateNetworkRoiService
{
    public function __construct(
        protected LedgerWriter $ledger,
    ) {}

    /**
     * After ROI is credited to {@see $roiRecipient}, pay their direct sponsor (L1 only).
     *
     * @param  string  $sourceRoiEntryType  e.g. {@see LedgerEntry::TYPE_ROI_DAILY}
     */
    public function onRoiCreditedToUser(User $roiRecipient, string $roiAmountUsd, int $investmentId, string $sourceRoiEntryType): void
    {
        if (! RewardPlan::roiSharingEnabled()) {
            return;
        }

        if (bccomp($roiAmountUsd, '0', 4) <= 0) {
            return;
        }

        if (! $roiRecipient->referred_by) {
            return;
        }

        $sponsor = User::query()->find($roiRecipient->referred_by);
        if (! $sponsor || $sponsor->is_blocked || $sponsor->participation_activated_at === null) {
            return;
        }

        $pct = RewardPlan::roiSharingDirectPercent();
        if ($pct <= 0) {
            return;
        }

        $rate = bcdiv(number_format($pct, 4, '.', ''), '100', 8);
        $share = bcmul($roiAmountUsd, $rate, 4);
        if (bccomp($share, '0', 4) <= 0) {
            return;
        }

        $this->ledger->record(
            $sponsor,
            LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI,
            $share,
            'investment',
            $investmentId,
            [
                'network_level' => 1,
                'percent' => $pct,
                'from_user_id' => $roiRecipient->id,
                'source_roi_entry_type' => $sourceRoiEntryType,
                'framework' => 'roi_sharing',
            ],
        );
    }
}
