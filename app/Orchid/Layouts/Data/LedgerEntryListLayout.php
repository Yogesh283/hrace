<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\LedgerEntry;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\DropDown;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class LedgerEntryListLayout extends AdminVipTable
{
    public $target = 'ledger_entries';

    protected $title = 'Ledger entries';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (LedgerEntry $r) => AdminTable::id($r->id)),
            TD::make('user_id', __('Member'))->sort()
                ->render(fn (LedgerEntry $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('entry_type', __('Type'))->sort()
                ->render(fn (LedgerEntry $r) => AdminTable::badge($r->entry_type, 'vip')),
            TD::make('amount_usd', __('Amount'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (LedgerEntry $r) => AdminTable::money($r->amount_usd)),
            TD::make('balance_after_usd', __('Balance after'))->align(TD::ALIGN_RIGHT)
                ->render(fn (LedgerEntry $r) => AdminTable::money($r->balance_after_usd)),
            TD::make('reference_type', __('Ref'))->render(fn (LedgerEntry $r) => AdminTable::text($r->reference_type)),
            TD::make('created_at', __('Date'))->sort()
                ->render(fn (LedgerEntry $r) => AdminTable::dateTime($r->created_at)),
            TD::make(__('Actions'))->align(TD::ALIGN_CENTER)->width('96px')
                ->render(fn (LedgerEntry $r) => DropDown::make()->icon('bs.three-dots-vertical')->list([
                    Link::make(__('Edit'))->route('platform.data.ledger-entries.edit', $r->id)->icon('bs.pencil'),
                    Button::make(__('Delete'))->icon('bs.trash3')->confirm(__('Delete?'))->method('remove', ['id' => $r->id]),
                ])),
        ];
    }
}
