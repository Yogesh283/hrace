<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Services\Blockchain\ContractWatchService;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

/**
 * Admin hub: all contracts, live on-chain status, ICO/stake overall reports.
 */
class BlockchainOverviewScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $snap = app(ContractWatchService::class)->snapshot();
        $live = $snap['live'] ?? [];
        $reports = $snap['reports'] ?? [];

        return [
            'network' => $snap['network'] ?? '—',
            'chain_id' => $snap['chain_id'] ?? '—',
            'explorer' => $snap['explorer'] ?? 'https://bscscan.com',
            'rpc_ok' => (bool) ($live['rpc_ok'] ?? false),
            'addresses' => $snap['addresses'] ?? [],
            'catalog' => $snap['catalog'] ?? [],
            'readiness' => $snap['readiness'] ?? [],
            'member_flow' => $snap['member_flow'] ?? [],
            'ico_live' => $live['ico'] ?? [],
            'reserve_live' => $live['reserve'] ?? [],
            'engine_live' => $live['engine'] ?? [],
            'token_live' => $live['token'] ?? [],
            'hold_live' => $live['income_hold'] ?? [],
            'oracle_live' => $live['oracle'] ?? [],
            'events' => $snap['events'] ?? [],
            'indexed' => [
                'stake_users' => (int) ($reports['stake_users'] ?? 0),
                'stake_rows' => (int) ($reports['stake_rows'] ?? 0),
                'stake_usdt' => (string) ($reports['stake_usdt'] ?? '0'),
                'stake_race' => (string) ($reports['stake_race'] ?? '0'),
                'ico_buys' => (int) ($reports['ico_buys'] ?? 0),
                'ico_users' => (int) ($reports['ico_users'] ?? 0),
                'ico_usdt' => (string) ($reports['ico_usdt'] ?? '0'),
                'ico_race' => (string) ($reports['ico_race'] ?? '0'),
            ],
            'recent_purchases' => $reports['recent_purchases'] ?? [],
            'recent_stakes' => $reports['recent_stakes'] ?? [],
        ];
    }

    public function name(): ?string
    {
        return __('All contracts & reports');
    }

    public function description(): ?string
    {
        return __('Every contract address, live on-chain activity, ICO 600k reserve, and indexed member reports — read-only for live testing.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Link::make(__('On-chain stakes'))
                ->icon('bs.stack')
                ->route('platform.data.blockchain-stakes'),
            Link::make(__('Contracts detail'))
                ->icon('bs.eye')
                ->route('platform.data.contracts-watch'),
            Link::make(__('ICO deposit / start'))
                ->icon('bs.gear')
                ->route('platform.data.ico-contract'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::view('orchid.blockchain-overview'),
        ];
    }
}
