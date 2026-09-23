<?php

namespace App\Services\Income;

use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Models\User;
use App\Models\Withdrawal;
use App\Support\RewardPlan;

class AffiliateTeamRewardsService
{
    public function __construct(
        protected LedgerWriter $ledger,
        protected ReferralTree $tree,
        protected CompanyReserveLedger $companyReserve,
    ) {}

    /**
     * Split income-withdrawal Team Reward (10% of gross) across referral uplines L1–L10.
     * Unpaid share (missing / unqualified uplines) → admin treasury ledger (NOT the $1/1% Admin Fee).
     * Triggered only from WithdrawalService (USDT income cash-out) — not maturity/EMI/Engine.
     *
     * @return string Total USD paid to uplines
     */
    public function onWithdrawal(User $withdrawer, Withdrawal $withdrawal): string
    {
        \App\Support\BlockchainMode::assertReadOnlyRewards();

        $gross = number_format((float) $withdrawal->amount_usd, 2, '.', '');
        $feePool = $withdrawal->teamRewardUsd();

        if (bccomp($feePool, '0', 2) <= 0) {
            return '0.00';
        }

        if ($this->teamRewardsAlreadyPaid($withdrawal->id)) {
            return $this->sumTeamRewardsPaid($withdrawal->id);
        }

        $weights = RewardPlan::affiliateTeamRewards()['level_percent'] ?? [];
        $sumWeights = RewardPlan::teamRewardWeightSum();
        if (bccomp($sumWeights, '0', 4) <= 0) {
            $this->creditUnallocatedFeeToAdmin($withdrawal, $feePool, $gross);

            return '0.00';
        }

        $paidTotal = '0.00';
        $withdrawer = User::query()->findOrFail($withdrawer->id);
        $uplines = $this->tree->uplinesByReferral($withdrawer, 10);

        foreach ($uplines as $index => $recipient) {
            $level = $index + 1;
            $weight = $weights[$level] ?? null;
            if ($weight === null || (float) $weight <= 0) {
                continue;
            }

            if (! $this->canPayTeamRewardAtLevel($withdrawer, $recipient, $level)) {
                continue;
            }

            $rate = bcdiv((string) $weight, $sumWeights, 8);
            $amount = bcmul($feePool, $rate, 2);
            if (bccomp($amount, '0', 2) <= 0) {
                continue;
            }

            $this->ledger->record(
                $recipient,
                LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD,
                $amount,
                'withdrawal',
                $withdrawal->id,
                [
                    'level' => $level,
                    'weight' => (float) $weight,
                    'fee_pool_usd' => $feePool,
                    'team_reward_usd' => $feePool,
                    'withdrawal_gross_usd' => $gross,
                    'from_user_id' => $withdrawer->id,
                    'framework' => 'community_team_rewards',
                ],
            );
            $paidTotal = bcadd($paidTotal, $amount, 2);
        }

        $remainder = bcsub($feePool, $paidTotal, 2);
        if (bccomp($remainder, '0', 2) > 0) {
            $this->creditUnallocatedFeeToAdmin($withdrawal, $remainder, $gross, $paidTotal);
        }

        return $paidTotal;
    }

    private function creditUnallocatedFeeToAdmin(
        Withdrawal $withdrawal,
        string $amount,
        string $gross,
        string $paidToLevels = '0.00',
    ): void {
        if (bccomp($amount, '0', 2) <= 0) {
            return;
        }

        $this->ledger->record(
            $this->companyReserve->user(),
            LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE,
            $amount,
            'withdrawal',
            $withdrawal->id,
            [
                'source' => 'team_reward_unallocated',
                'from_user_id' => $withdrawal->user_id,
                'withdrawal_gross_usd' => $gross,
                'fee_pool_usd' => $withdrawal->teamRewardUsd(),
                'team_reward_usd' => $withdrawal->teamRewardUsd(),
                'paid_to_levels_usd' => $paidToLevels,
                'note' => 'Unallocated Community Team Rewards fee share',
                'admin_wallet_bep20' => SiteSetting::treasuryAddress(),
                'network' => SiteSetting::treasuryNetworkLabel(),
            ],
        );
    }

    private function teamRewardsAlreadyPaid(int $withdrawalId): bool
    {
        return LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
            ->where('reference_type', 'withdrawal')
            ->where('reference_id', $withdrawalId)
            ->exists();
    }

    private function sumTeamRewardsPaid(int $withdrawalId): string
    {
        return number_format((float) LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD)
            ->where('reference_type', 'withdrawal')
            ->where('reference_id', $withdrawalId)
            ->sum('amount_usd'), 2, '.', '');
    }

    /**
     * L1–L10 team reward: self $50+ active, not blocked, and N activated directs for level N.
     */
    private function canPayTeamRewardAtLevel(User $withdrawer, User $recipient, int $level): bool
    {
        return $this->tree->qualifiesForTeamRewardLevelPayout($recipient, $level);
    }
}
