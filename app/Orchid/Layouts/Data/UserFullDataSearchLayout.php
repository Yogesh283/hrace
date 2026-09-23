<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use Orchid\Screen\Fields\Input;
use Orchid\Screen\Layouts\Rows;

class UserFullDataSearchLayout extends Rows
{
    protected function fields(): iterable
    {
        return [
            Input::make('search')
                ->title(__('Search'))
                ->value(request()->query('search'))
                ->placeholder(__('ID, member code, name, email, referral code, or wallet address'))
                ->help(__('Search is read-only and returns paginated member matches.')),
        ];
    }
}
