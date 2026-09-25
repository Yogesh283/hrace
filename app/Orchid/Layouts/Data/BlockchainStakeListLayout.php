<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\BlockchainEngineStake;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class BlockchainStakeListLayout extends AdminVipTable
{
    public $target = 'stakes';

    protected $title = 'On-chain stakes';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('64px')
                ->render(fn (BlockchainEngineStake $r) => AdminTable::id($r->id)),
            TD::make('user_id', __('Member'))
                ->render(fn (BlockchainEngineStake $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('wallet_address', __('Wallet'))
                ->width('140px')
                ->render(function (BlockchainEngineStake $r) {
                    $w = (string) $r->wallet_address;
                    if ($w === '') {
                        return '<span class="rx-tbl-muted">—</span>';
                    }
                    $short = strlen($w) > 12 ? substr($w, 0, 6).'…'.substr($w, -4) : $w;

                    return '<code class="rx-bc-addr" title="'.e($w).'">'.e($short).'</code>';
                }),
            TD::make('principal_usdt', __('USDT'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (BlockchainEngineStake $r) => AdminTable::money($r->principal_usdt)),
            TD::make('staked_race', __('RACE'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (BlockchainEngineStake $r) => '<span class="rx-tbl-money">'.e(number_format((float) $r->staked_race, 4)).'</span>'),
            TD::make('source_type', __('Source'))
                ->render(fn (BlockchainEngineStake $r) => AdminTable::badge(
                    (string) ($r->source_type ?: '—'),
                    $r->source_type === BlockchainEngineStake::SOURCE_ICO ? 'vip' : 'default',
                )),
            TD::make('lock_seconds', __('Lock'))
                ->render(function (BlockchainEngineStake $r) {
                    $s = (int) $r->lock_seconds;
                    if ($s <= 0) {
                        return AdminTable::badge('Flexible', 'muted');
                    }

                    return AdminTable::badge((string) (int) round($s / 86400).'d', 'default');
                }),
            TD::make('status', __('Status'))->sort()
                ->render(fn (BlockchainEngineStake $r) => AdminTable::badge(
                    (string) ($r->status ?: ($r->withdrawn ? 'withdrawn' : 'active')),
                    $r->withdrawn ? 'muted' : 'success',
                )),
            TD::make('stake_index', __('Idx'))->align(TD::ALIGN_CENTER)->width('56px'),
            TD::make('tx_hash', __('Tx'))
                ->render(function (BlockchainEngineStake $r) {
                    $tx = (string) $r->tx_hash;
                    if ($tx === '') {
                        return '—';
                    }
                    $short = substr($tx, 0, 8).'…';

                    return '<code title="'.e($tx).'">'.e($short).'</code>';
                }),
        ];
    }
}
