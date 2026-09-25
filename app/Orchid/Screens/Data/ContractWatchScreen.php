<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Services\Blockchain\ContractWatchService;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

class ContractWatchScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        return app(ContractWatchService::class)->snapshot();
    }

    public function name(): ?string
    {
        return __('Contracts watch');
    }

    public function description(): ?string
    {
        return __('Live addresses and on-chain status for ICO, staking, income hold, vault, and token. Read-only.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Link::make(__('Blockchain overview'))
                ->icon('bs.graph-up')
                ->route('platform.data.blockchain-overview'),
            Link::make(__('On-chain stakes'))
                ->icon('bs.stack')
                ->route('platform.data.blockchain-stakes'),
            Link::make(__('ICO actions'))
                ->icon('bs.cash-coin')
                ->route('platform.data.ico-contract'),
            Link::make(__('Multisig funds'))
                ->icon('bs.safe2')
                ->route('platform.data.multisig-funds'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::view('orchid.contract-watch'),
        ];
    }
}
