<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\LedgerEntry;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\TD;

class UserFullDataLedgerEntriesLayout extends AdminVipTable
{
    public $target = 'ledger_entries';

    protected $title = 'Latest ledger entries';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (LedgerEntry $entry) => AdminTable::id($entry->id)),
            TD::make('entry_type', __('Type'))
                ->render(fn (LedgerEntry $entry) => AdminTable::badge((string) $entry->entry_type, 'vip')),
            TD::make('amount_usd', __('Amount'))->align(TD::ALIGN_RIGHT)
                ->render(fn (LedgerEntry $entry) => AdminTable::money($entry->amount_usd)),
            TD::make('balance_after_usd', __('Balance after'))->align(TD::ALIGN_RIGHT)
                ->render(fn (LedgerEntry $entry) => AdminTable::money($entry->balance_after_usd)),
            TD::make('reference_type', __('Reference type'))
                ->render(fn (LedgerEntry $entry) => AdminTable::text($entry->reference_type)),
            TD::make('reference_id', __('Reference ID'))->align(TD::ALIGN_CENTER)
                ->render(fn (LedgerEntry $entry) => AdminTable::text($entry->reference_id === null ? null : (string) $entry->reference_id)),
            TD::make('created_at', __('Date'))
                ->render(fn (LedgerEntry $entry) => AdminTable::dateTime($entry->created_at)),
        ];
    }
}
