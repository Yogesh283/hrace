<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\BlockchainEngineStake;
use App\Models\IcoPurchase;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Services\Blockchain\ContractWatchService;
use Illuminate\Support\Facades\Schema;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

/**
 * Read-only blockchain overview: ICO sold/raised + stake counts (on-chain + indexed).
 */
class BlockchainOverviewScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $snap = app(ContractWatchService::class)->snapshot();
        $live = $snap['live'] ?? [];
        $ico = $live['ico'] ?? [];
        $engine = $live['engine'] ?? [];
        $token = $live['token'] ?? [];

        $stakeUsers = 0;
        $stakeRows = 0;
        $stakeUsdt = '0';
        $stakeRace = '0';
        $icoBuys = 0;
        $icoUsdt = '0';
        $icoRace = '0';

        if (Schema::hasTable((new BlockchainEngineStake)->getTable())) {
            $q = BlockchainEngineStake::query()->where('withdrawn', false);
            $stakeRows = (int) (clone $q)->count();
            $stakeUsers = (int) (clone $q)->distinct('wallet_address')->count('wallet_address');
            $stakeUsdt = (string) ((clone $q)->sum('principal_usdt') ?: '0');
            $stakeRace = (string) ((clone $q)->sum('staked_race') ?: '0');
        }

        if (Schema::hasTable((new IcoPurchase)->getTable())) {
            $iq = IcoPurchase::query();
            $icoBuys = (int) $iq->count();
            $icoUsdt = (string) (IcoPurchase::query()->sum('usdt_amount') ?: '0');
            $icoRace = (string) (IcoPurchase::query()->sum('race_amount') ?: '0');
        }

        return [
            'network' => $snap['network'] ?? '—',
            'chain_id' => $snap['chain_id'] ?? '—',
            'explorer' => $snap['explorer'] ?? 'https://bscscan.com',
            'rpc_ok' => (bool) ($live['rpc_ok'] ?? false),
            'addresses' => $snap['addresses'] ?? [],
            'ico_live' => $ico,
            'engine_live' => $engine,
            'token_live' => $token,
            'indexed' => [
                'stake_users' => $stakeUsers,
                'stake_rows' => $stakeRows,
                'stake_usdt' => $stakeUsdt,
                'stake_race' => $stakeRace,
                'ico_buys' => $icoBuys,
                'ico_usdt' => $icoUsdt,
                'ico_race' => $icoRace,
            ],
        ];
    }

    public function name(): ?string
    {
        return __('Blockchain overview');
    }

    public function description(): ?string
    {
        return __('ICO coins sold, funds raised, and on-chain stakes — read-only. Live RPC + indexed DB.');
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
            Link::make(__('Contracts (read-only)'))
                ->icon('bs.eye')
                ->route('platform.data.contracts-watch'),
            Link::make(__('ICO settings'))
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
