<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\UserWallet;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataWalletLayout extends AdminVipTable
{
    public $target = 'wallets';

    protected $title = 'Wallet';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (UserWallet $wallet) => AdminTable::id($wallet->id)),
            TD::make('balance_usd', __('USD balance'))->align(TD::ALIGN_RIGHT)
                ->render(fn (UserWallet $wallet) => AdminTable::money($wallet->balance_usd)),
            TD::make('race_coin_balance', __('Race Coin'))->align(TD::ALIGN_RIGHT)
                ->render(fn (UserWallet $wallet) => AdminTable::text(number_format((float) $wallet->race_coin_balance, 4, '.', ',').' RC')),
            TD::make('created_at', __('Created'))
                ->render(fn (UserWallet $wallet) => AdminTable::dateTime($wallet->created_at)),
            TD::make('updated_at', __('Updated'))
                ->render(fn (UserWallet $wallet) => AdminTable::dateTime($wallet->updated_at)),
        ];
    }
}
