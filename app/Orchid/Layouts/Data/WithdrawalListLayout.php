<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\Withdrawal;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class WithdrawalListLayout extends AdminVipTable
{
    public $target = 'withdrawals';

    protected $title = 'Withdrawals';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (Withdrawal $r) => AdminTable::id($r->id)),
            TD::make('user_id', __('Member'))->sort()
                ->render(fn (Withdrawal $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('amount_usd', __('Gross'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $r) => AdminTable::money($r->amount_usd)),
            TD::make('team_reward_usd', __('Team 10%'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $r) => AdminTable::money($r->teamRewardUsd())),
            TD::make('admin_fee_usd', __('Admin Fee'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $r) => AdminTable::money($r->adminFeeUsd())),
            TD::make('net_usd', __('Net'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $r) => AdminTable::money($r->net_usd)),
            TD::make('status', __('Status'))->sort()
                ->render(fn (Withdrawal $r) => AdminTable::badge(
                    Withdrawal::statusLabels()[$r->status] ?? $r->status,
                    match ($r->status) {
                        Withdrawal::STATUS_COMPLETED => 'success',
                        Withdrawal::STATUS_REJECTED => 'danger',
                        default => 'warning',
                    },
                )),
            TD::make('destination_address', __('Address'))
                ->render(function (Withdrawal $r) {
                    $addr = (string) ($r->destination_address ?? '');
                    $safe = e($addr);
                    $js = e("navigator.clipboard && navigator.clipboard.writeText('{$addr}')");

                    return '<div class="d-flex align-items-center gap-2">'
                        .'<span class="rx-admin-code">'.$safe.'</span>'
                        .'<button type="button" class="btn btn-link px-0 py-0" onclick="'.$js.'">Copy</button>'
                        .'</div>';
                }),
            TD::make(__('Actions'))
                ->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $r) => Link::make(__('Edit'))
                    ->route('platform.data.withdrawals.edit', $r)
                    ->icon('bs.pencil-square')),
            TD::make('created_at', __('Date'))->sort()
                ->render(fn (Withdrawal $r) => AdminTable::dateTime($r->created_at)),
        ];
    }
}
