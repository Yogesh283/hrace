<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\User;

use Orchid\Screen\Field;
use Orchid\Screen\Fields\CheckBox;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Layouts\Rows;

class UserEditLayout extends Rows
{
    /**
     * The screen's layout elements.
     *
     * @return Field[]
     */
    public function fields(): array
    {
        return [
            Input::make('user.name')
                ->type('text')
                ->max(255)
                ->required()
                ->title(__('Name'))
                ->placeholder(__('Name')),

            Input::make('user.email')
                ->type('email')
                ->required()
                ->title(__('Email'))
                ->placeholder(__('Email')),

            Input::make('user.level')
                ->type('number')
                ->min(1)
                ->max(99)
                ->title(__('Level'))
                ->help(__('Sponsor / rank level shown in team structure.')),

            Input::make('user.referral_code')
                ->title(__('Referral code'))
                ->readonly(),

            CheckBox::make('user.is_blocked')
                ->title(__('Account blocked'))
                ->placeholder(__('Suspended — cannot login or join under this code'))
                ->sendTrueOrFalse(),

            CheckBox::make('user.withdrawals_disabled')
                ->title(__('Withdrawals disabled'))
                ->placeholder(__('Member cannot submit new withdrawal requests'))
                ->sendTrueOrFalse(),
        ];
    }
}
