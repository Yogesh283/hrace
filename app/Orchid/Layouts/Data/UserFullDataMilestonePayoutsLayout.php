<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\MilestonePayout;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataMilestonePayoutsLayout extends AdminVipTable
{
    public $target = 'milestone_payouts';

    protected $title = 'Milestone payouts';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (MilestonePayout $payout) => AdminTable::id($payout->id)),
            TD::make('milestone_code', __('Milestone'))
                ->render(fn (MilestonePayout $payout) => AdminTable::badge((string) $payout->milestone_code, 'gold')),
            TD::make('created_at', __('Awarded'))
                ->render(fn (MilestonePayout $payout) => AdminTable::dateTime($payout->created_at)),
        ];
    }
}
