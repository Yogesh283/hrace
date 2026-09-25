<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use Orchid\Screen\Fields\Input;
use Orchid\Screen\Layouts\Rows;

class BlockchainStakeSearchLayout extends Rows
{
    protected function fields(): iterable
    {
        return [
            Input::make('search')
                ->title(__('Search stakes'))
                ->value(request()->query('search'))
                ->placeholder(__('Wallet, member name/email/ID, tx hash, status…')),
        ];
    }
}
