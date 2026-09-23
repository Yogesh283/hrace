<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\RaceCoinSwap;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class RaceCoinSwapListLayout extends AdminVipTable
{
    public $target = 'race_coin_swaps';

    protected $title = 'Race Coin swaps';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (RaceCoinSwap $r) => AdminTable::id($r->id)),
            TD::make('user_id', __('Member'))->sort()
                ->render(fn (RaceCoinSwap $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('swap_type', __('Type'))->sort()
                ->render(fn (RaceCoinSwap $r) => AdminTable::badge(
                    RaceCoinSwap::typeLabels()[$r->swap_type] ?? $r->swap_type,
                    $r->swap_type === RaceCoinSwap::TYPE_SWAP_CREDIT ? 'success' : 'warning',
                )),
            TD::make('usdt_amount', __('USDT'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (RaceCoinSwap $r) => $r->usdt_amount !== null
                    ? AdminTable::money($r->usdt_amount)
                    : AdminTable::text(null)),
            TD::make('coins_amount', __('Race Coin'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(function (RaceCoinSwap $r) {
                    $n = number_format((float) $r->coins_amount, 4, '.', ',');
                    $negative = (float) $r->coins_amount < 0;
                    $class = $negative ? 'rx-tbl-money rx-tbl-money--danger' : 'rx-tbl-money';

                    return '<span class="'.$class.'">'.($negative ? '−' : '+').e($n).' RC</span>';
                }),
            TD::make('balance_after_coins', __('Balance after'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (RaceCoinSwap $r) => AdminTable::text(number_format((float) $r->balance_after_coins, 4, '.', ',').' RC')),
            TD::make('tx_hash', __('Tx hash'))
                ->render(function (RaceCoinSwap $r) {
                    $hash = trim((string) ($r->tx_hash ?? ''));
                    if ($hash === '') {
                        return AdminTable::text(null);
                    }
                    $short = strlen($hash) > 14
                        ? substr($hash, 0, 10).'…'.substr($hash, -6)
                        : $hash;

                    return '<span class="rx-admin-code" title="'.e($hash).'">'.e($short).'</span>';
                }),
            TD::make('created_at', __('Date'))->sort()
                ->render(fn (RaceCoinSwap $r) => AdminTable::dateTime($r->created_at)),
        ];
    }
}
