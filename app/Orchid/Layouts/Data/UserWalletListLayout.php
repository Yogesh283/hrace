<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\UserWallet;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\DropDown;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class UserWalletListLayout extends AdminVipTable
{
    public $target = 'user_wallets';

    protected $title = 'User wallets';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (UserWallet $r) => AdminTable::id($r->id)),
            TD::make('user_id', __('Member'))->sort()
                ->render(fn (UserWallet $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('balance_usd', __('Balance'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (UserWallet $r) => AdminTable::money($r->balance_usd)),
            TD::make('race_coin_balance', __('Race Coin'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (UserWallet $r) => AdminTable::text(
                    number_format((float) ($r->race_coin_balance ?? 0), 4, '.', ',').' RC',
                )),
            TD::make('created_at', __('Created'))->sort()->defaultHidden()
                ->render(fn (UserWallet $r) => AdminTable::dateTime($r->created_at)),
            TD::make('updated_at', __('Updated'))->sort()
                ->render(fn (UserWallet $r) => AdminTable::dateTime($r->updated_at)),
            TD::make(__('Actions'))->align(TD::ALIGN_CENTER)->width('96px')
                ->render(fn (UserWallet $r) => DropDown::make()->icon('bs.three-dots-vertical')->list([
                    Link::make(__('Edit'))->route('platform.data.user-wallets.edit', $r->id)->icon('bs.pencil'),
                    Button::make(__('Delete'))->icon('bs.trash3')->confirm(__('Delete?'))->method('remove', ['id' => $r->id]),
                ])),
        ];
    }
}
