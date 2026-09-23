<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\RaceCoinSwap;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataRaceCoinSwapsLayout extends AdminVipTable
{
    public $target = 'race_coin_swaps';

    protected $title = 'Latest Race Coin swaps';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (RaceCoinSwap $swap) => AdminTable::id($swap->id)),
            TD::make('swap_type', __('Type'))
                ->render(fn (RaceCoinSwap $swap) => AdminTable::badge(
                    RaceCoinSwap::typeLabels()[$swap->swap_type] ?? (string) $swap->swap_type,
                    $swap->swap_type === RaceCoinSwap::TYPE_SWAP_CREDIT ? 'success' : 'warning',
                )),
            TD::make('usdt_amount', __('USDT'))->align(TD::ALIGN_RIGHT)
                ->render(fn (RaceCoinSwap $swap) => $swap->usdt_amount === null
                    ? AdminTable::text(null)
                    : AdminTable::money($swap->usdt_amount)),
            TD::make('coins_amount', __('Race Coin'))->align(TD::ALIGN_RIGHT)
                ->render(fn (RaceCoinSwap $swap) => AdminTable::text(number_format((float) $swap->coins_amount, 4, '.', ',').' RC')),
            TD::make('balance_after_coins', __('Balance after'))->align(TD::ALIGN_RIGHT)
                ->render(fn (RaceCoinSwap $swap) => AdminTable::text(number_format((float) $swap->balance_after_coins, 4, '.', ',').' RC')),
            TD::make('tx_hash', __('Tx hash'))
                ->render(fn (RaceCoinSwap $swap) => $this->shortCode($swap->tx_hash)),
            TD::make('created_at', __('Date'))
                ->render(fn (RaceCoinSwap $swap) => AdminTable::dateTime($swap->created_at)),
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
