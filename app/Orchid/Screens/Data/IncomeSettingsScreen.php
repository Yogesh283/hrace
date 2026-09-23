<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Support\RewardPlan;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

class IncomeSettingsScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        return [
            'participation_tiers' => RewardPlan::builtForGrowthDurationTiersForUi(),
            'community_referral_levels' => config('reward_plan.community_referral_percent', []),
            'leadership_ranks' => RewardPlan::communityLeadershipRanks(),
            'roi_sharing_percent' => (float) config('reward_plan.roi_sharing.direct_roi_of_roi_percent', 10),
            'team_rewards_fee_percent' => (float) (config('reward_plan.community_team_rewards.withdrawal_fee_percent', 10)),
            'team_reward_levels' => config('reward_plan.community_team_rewards.level_percent', []),
            'withdrawal_rate_limit' => config('reward_plan.community_team_rewards.rate_limit', []),
            'stake_unlock' => config('reward_plan.participation_tiers.stake_unlock', []),
            'holding_rollover' => config('reward_plan.holding_rollover', []),
        ];
    }

    public function name(): ?string
    {
        return __('Income plan (read-only)');
    }

    public function description(): ?string
    {
        return __('Official RACE reward rates from config/reward_plan.php. Change rates in that config file (or deploy), then clear config cache.');
    }

    public function commandBar(): iterable
    {
        return [];
    }

    public function layout(): iterable
    {
        return [
            Layout::view('orchid.income-settings-pdf'),
        ];
    }
}
