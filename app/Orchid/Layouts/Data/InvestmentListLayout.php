<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\Investment;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\DropDown;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class InvestmentListLayout extends AdminVipTable
{
    public $target = 'investments';

    protected $title = 'Investments';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (Investment $r) => AdminTable::id($r->id)),
            TD::make('user_id', __('Member'))->sort()
                ->render(fn (Investment $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('amount_usd', __('Amount'))->sort()
                ->align(TD::ALIGN_RIGHT)
                ->render(fn (Investment $r) => AdminTable::money($r->amount_usd)),
            TD::make('duration_days', __('Days'))->sort()->align(TD::ALIGN_CENTER),
            TD::make('roi_percent_monthly', __('ROI %'))->align(TD::ALIGN_CENTER),
            TD::make('status', __('Status'))->sort()
                ->render(fn (Investment $r) => AdminTable::badge(
                    $r->status,
                    $r->status === 'active' ? 'success' : 'muted',
                )),
            TD::make('next_roi_at', __('Next ROI'))
                ->render(fn (Investment $r) => AdminTable::dateTime($r->next_roi_at)),
            TD::make('created_at', __('Created'))->sort()->defaultHidden()
                ->render(fn (Investment $r) => AdminTable::dateTime($r->created_at)),
            TD::make(__('Actions'))->align(TD::ALIGN_CENTER)->width('96px')
                ->render(fn (Investment $r) => DropDown::make()->icon('bs.three-dots-vertical')->list([
                    Link::make(__('Edit'))->route('platform.data.investments.edit', $r->id)->icon('bs.pencil'),
                    Button::make(__('Delete'))->icon('bs.trash3')->confirm(__('Delete?'))->method('remove', ['id' => $r->id]),
                ])),
        ];
    }
}
