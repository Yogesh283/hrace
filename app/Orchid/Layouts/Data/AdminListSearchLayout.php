<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use Orchid\Screen\Fields\Input;
use Orchid\Screen\Layouts\Rows;

/**
 * Shared narrow search field for admin list screens.
 */
class AdminListSearchLayout extends Rows
{
    protected function fields(): iterable
    {
        return [
            Input::make('search')
                ->title(__('Search'))
                ->value(request()->query('search'))
                ->placeholder(__('ID, member, email, wallet, status…')),
        ];
    }
}
