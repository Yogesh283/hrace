<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\BlockchainParticipation;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataBlockchainParticipationsLayout extends AdminVipTable
{
    public $target = 'blockchain_participations';

    protected $title = 'Blockchain staking';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (BlockchainParticipation $participation) => AdminTable::id($participation->id)),
            TD::make('investment_id', __('Investment'))->align(TD::ALIGN_CENTER)
                ->render(fn (BlockchainParticipation $participation) => AdminTable::text(
                    $participation->investment_id === null ? null : '#'.$participation->investment_id,
                )),
            TD::make('wallet_address', __('Wallet'))
                ->render(fn (BlockchainParticipation $participation) => $this->shortCode($participation->wallet_address)),
            TD::make('principal_usdt', __('Principal'))->align(TD::ALIGN_RIGHT)
                ->render(fn (BlockchainParticipation $participation) => AdminTable::money($participation->principal_usdt, 'USDT ')),
            TD::make('lock_seconds', __('Lock days'))->align(TD::ALIGN_CENTER)
                ->render(fn (BlockchainParticipation $participation) => (string) floor(((int) $participation->lock_seconds) / 86400)),
            TD::make('daily_rate_bps', __('Daily bps'))->align(TD::ALIGN_CENTER),
            TD::make('stake_index', __('Stake'))->align(TD::ALIGN_CENTER),
            TD::make('tx_hash', __('Tx hash'))
                ->render(fn (BlockchainParticipation $participation) => $this->shortCode($participation->tx_hash)),
            TD::make('contract_address', __('Contract'))
                ->render(fn (BlockchainParticipation $participation) => $this->shortCode($participation->contract_address)),
            TD::make('synced_at', __('Synced'))
                ->render(fn (BlockchainParticipation $participation) => AdminTable::dateTime($participation->synced_at)),
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
