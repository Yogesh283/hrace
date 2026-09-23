<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\MilestonePayout;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\DropDown;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class MilestonePayoutListLayout extends AdminVipTable
{
    public $target = 'milestone_payouts';

    protected $title = 'Milestone payouts';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (MilestonePayout $r) => AdminTable::id($r->id)),
            TD::make('user_id', __('Member'))->sort()
                ->render(fn (MilestonePayout $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('milestone_code', __('Milestone'))->sort()
                ->render(fn (MilestonePayout $r) => AdminTable::badge($r->milestone_code, 'gold')),
            TD::make('created_at', __('Awarded'))->sort()
                ->render(fn (MilestonePayout $r) => AdminTable::dateTime($r->created_at)),
            TD::make(__('Actions'))->align(TD::ALIGN_CENTER)->width('96px')
                ->render(fn (MilestonePayout $r) => DropDown::make()->icon('bs.three-dots-vertical')->list([
                    Link::make(__('Edit'))->route('platform.data.milestone-payouts.edit', $r->id)->icon('bs.pencil'),
                    Button::make(__('Delete'))->icon('bs.trash3')->confirm(__('Delete?'))->method('remove', ['id' => $r->id]),
                ])),
        ];
    }
}
