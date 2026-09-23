<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\RaceCoinSwap;
use App\Models\UserWallet;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\RaceCoinSwapListLayout;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

class RaceCoinSwapListScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $totalCoins = (float) (UserWallet::query()->sum('race_coin_balance') ?? 0);
        $totalUsdt = (float) RaceCoinSwap::query()
            ->where('swap_type', RaceCoinSwap::TYPE_SWAP_CREDIT)
            ->sum('usdt_amount');

        return [
            'race_coin_swaps' => RaceCoinSwap::query()
                ->with('user:id,name,email,member_number')
                ->defaultSort('id', 'desc')
                ->paginate(30),
            'total_race_coins' => number_format($totalCoins, 4, '.', ','),
            'total_usdt_swapped' => number_format($totalUsdt, 2, '.', ','),
        ];
    }

    public function name(): ?string
    {
        return __('Race Coin swaps');
    }

    public function description(): ?string
    {
        return __('USDT → Race Coin swaps and ID activations. Price: $'.number_format((float) config('race_coin.price_usd', 0.10), 2).' per coin.');
    }

    public function layout(): iterable
    {
        return [
            Layout::view('platform.race-coin-summary'),
            RaceCoinSwapListLayout::class,
        ];
    }
}
