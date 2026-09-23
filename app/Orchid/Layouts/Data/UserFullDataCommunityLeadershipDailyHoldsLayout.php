<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\CommunityLeadershipDailyHold;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataCommunityLeadershipDailyHoldsLayout extends AdminVipTable
{
    public $target = 'community_leadership_daily_holds';

    protected $title = 'Community leadership daily holds';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (CommunityLeadershipDailyHold $hold) => AdminTable::id($hold->id)),
            TD::make('hold_date', __('Date'))
                ->render(fn (CommunityLeadershipDailyHold $hold) => AdminTable::dateTime($hold->hold_date)),
            TD::make('rank_level', __('Rank'))->align(TD::ALIGN_CENTER)
                ->render(fn (CommunityLeadershipDailyHold $hold) => AdminTable::level((int) $hold->rank_level)),
            TD::make('team_volume_usd', __('Team volume'))->align(TD::ALIGN_RIGHT)
                ->render(fn (CommunityLeadershipDailyHold $hold) => AdminTable::money($hold->team_volume_usd)),
            TD::make('self_hold_usd', __('Self hold'))->align(TD::ALIGN_RIGHT)
                ->render(fn (CommunityLeadershipDailyHold $hold) => AdminTable::money($hold->self_hold_usd)),
            TD::make('qualified_directs', __('Qualified directs'))->align(TD::ALIGN_CENTER),
            TD::make('created_at', __('Recorded'))
                ->render(fn (CommunityLeadershipDailyHold $hold) => AdminTable::dateTime($hold->created_at)),
        ];
    }
}
