<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Support\RewardPlan;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RewardsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $feeRules = RewardPlan::walletWithdrawalFeeRulesForUi();
        $exampleFee = RewardPlan::calculateWalletWithdrawalFee(100);

        $lifetime = LedgerEntry::query()
            ->production()
            ->where('user_id', $user->id)
            ->whereIn('entry_type', [
                LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD,
                LedgerEntry::TYPE_AFFILIATE_TEAM_REWARD,
            ])
            ->sum('amount_usd');

        $recent = LedgerEntry::query()
            ->production()
            ->where('user_id', $user->id)
            ->whereIn('entry_type', [
                LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD,
                LedgerEntry::TYPE_AFFILIATE_TEAM_REWARD,
            ])
            ->latest('id')
            ->limit(10)
            ->get(['amount_usd', 'created_at', 'meta'])
            ->map(fn (LedgerEntry $row) => [
                'amount_usd' => number_format((float) $row->amount_usd, 2, '.', ''),
                'at' => $row->created_at?->toIso8601String(),
                'level' => is_array($row->meta) ? ($row->meta['level'] ?? null) : null,
                'from_user_id' => is_array($row->meta) ? ($row->meta['from_user_id'] ?? null) : null,
            ]);

        return Inertia::render('Rewards', [
            'program_name' => 'Community Team Rewards',
            'withdrawal_fee' => $feeRules,
            'withdrawal_fee_percent' => $feeRules['percent'],
            'ladder' => RewardPlan::teamRewardLadder(),
            'lifetime_earned_usd' => number_format((float) $lifetime, 2, '.', ''),
            'recent_payouts' => $recent,
            'trigger_note' => 'User income withdrawal: 10% of gross → Community Team Rewards L1–L10 (25/15/12/10/9/8/6/5/5/5), '
                .'PLUS separate Admin Fee ($1 under $100 / 1% at $100+). '
                .'Unpaid team levels go to admin. Fixed staking maturity (10% RaceTreasury + EMI) does NOT pay this ladder. '
                .'Example $100 withdraw → Team $'.$exampleFee['team_reward_usd'].' (L1 $2.50) + Admin $'.$exampleFee['admin_fee_usd'].' → net $'.$exampleFee['net_usd'].'.',
        ]);
    }
}
