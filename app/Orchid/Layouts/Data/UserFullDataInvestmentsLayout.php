<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\Investment;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataInvestmentsLayout extends AdminVipTable
{
    public $target = 'investments';

    protected $title = 'Latest investments';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (Investment $investment) => AdminTable::id($investment->id)),
            TD::make('amount_usd', __('Amount'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Investment $investment) => AdminTable::money($investment->amount_usd)),
            TD::make('duration_days', __('Days'))->align(TD::ALIGN_CENTER),
            TD::make('roi_percent_daily', __('Daily ROI %'))->align(TD::ALIGN_CENTER),
            TD::make('total_roi_paid_usd', __('ROI paid'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Investment $investment) => AdminTable::money($investment->total_roi_paid_usd)),
            TD::make('status', __('Status'))
                ->render(fn (Investment $investment) => AdminTable::badge(
                    (string) $investment->status,
                    $investment->status === Investment::STATUS_ACTIVE ? 'success' : 'muted',
                )),
            TD::make('next_roi_at', __('Next ROI'))
                ->render(fn (Investment $investment) => AdminTable::dateTime($investment->next_roi_at)),
            TD::make('created_at', __('Created'))
                ->render(fn (Investment $investment) => AdminTable::dateTime($investment->created_at)),
        ];
    }
}
