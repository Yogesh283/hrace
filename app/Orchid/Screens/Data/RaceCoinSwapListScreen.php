<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\RaceCoinSwap;
use App\Models\UserWallet;
use App\Services\Income\RaceCoinService;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\RaceCoinSwapListLayout;
use Orchid\Screen\Action;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

class RaceCoinSwapListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();

        $totalCoins = (float) (UserWallet::query()->sum('race_coin_balance') ?? 0);
        $totalUsdt = (float) RaceCoinSwap::query()
            ->where('swap_type', RaceCoinSwap::TYPE_SWAP_CREDIT)
            ->sum('usdt_amount');

        $q = RaceCoinSwap::query()->with('user:id,name,email,member_number');
        $this->applyAdminSearch($q, $this->search, ['swap_type', 'tx_hash']);

        return [
            'search' => $this->search,
            'race_coin_swaps' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
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
        $price = app(RaceCoinService::class)->formattedPriceUsd(4);

        return __('USDT → Race Coin swaps and ID activations. Price: $'.$price.' per coin (Pancake live when available).');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return $this->searchCommandBar('platform.data.race-coin-swaps');
    }

    public function layout(): iterable
    {
        return [
            Layout::view('platform.race-coin-summary'),
            AdminListSearchLayout::class,
            RaceCoinSwapListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.race-coin-swaps';
    }
}
