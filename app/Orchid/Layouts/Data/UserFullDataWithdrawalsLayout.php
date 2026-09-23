<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\Withdrawal;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataWithdrawalsLayout extends AdminVipTable
{
    public $target = 'withdrawals';

    protected $title = 'Latest withdrawals';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (Withdrawal $withdrawal) => AdminTable::id($withdrawal->id)),
            TD::make('amount_usd', __('Gross'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $withdrawal) => AdminTable::money($withdrawal->amount_usd)),
            TD::make('team_reward_usd', __('Team 10%'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $withdrawal) => AdminTable::money($withdrawal->teamRewardUsd())),
            TD::make('admin_fee_usd', __('Admin Fee'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $withdrawal) => AdminTable::money($withdrawal->adminFeeUsd())),
            TD::make('net_usd', __('Net'))->align(TD::ALIGN_RIGHT)
                ->render(fn (Withdrawal $withdrawal) => AdminTable::money($withdrawal->net_usd)),
            TD::make('destination_address', __('Destination'))
                ->render(fn (Withdrawal $withdrawal) => $this->shortCode($withdrawal->destination_address)),
            TD::make('status', __('Status'))
                ->render(fn (Withdrawal $withdrawal) => AdminTable::badge(
                    Withdrawal::statusLabels()[$withdrawal->status] ?? (string) $withdrawal->status,
                    match ($withdrawal->status) {
                        Withdrawal::STATUS_COMPLETED => 'success',
                        Withdrawal::STATUS_REJECTED => 'danger',
                        default => 'warning',
                    },
                )),
            TD::make('created_at', __('Date'))
                ->render(fn (Withdrawal $withdrawal) => AdminTable::dateTime($withdrawal->created_at)),
        ];
    }

    private function shortCode(?string $value): string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return AdminTable::text(null);
        }

        $short = strlen($value) > 18
            ? substr($value, 0, 10).'...'.substr($value, -6)
            : $value;

        return '<span class="rx-admin-code" title="'.e($value).'">'.e($short).'</span>';
    }
}
