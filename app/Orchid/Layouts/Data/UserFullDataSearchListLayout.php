<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\User;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\DropDown;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class UserFullDataSearchListLayout extends AdminVipTable
{
    public $target = 'users';

    protected $title = 'User matches';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (User $user) => AdminTable::id($user->id)),
            TD::make('member_number', __('Code'))
                ->render(fn (User $user) => '<span class="rx-admin-code">'.e($user->member_code).'</span>'),
            TD::make('name', __('Member'))->sort()
                ->render(fn (User $user) => AdminTable::member($user->name, $user->email, $user->member_number)),
            TD::make('referral_code', __('Referral code'))
                ->render(fn (User $user) => AdminTable::text($user->referral_code)),
            TD::make('wallet_address', __('Wallet'))
                ->render(fn (User $user) => $this->shortCode($user->wallet_address)),
            TD::make('level', __('Level'))->sort()->align(TD::ALIGN_CENTER)
                ->render(fn (User $user) => AdminTable::level((int) $user->level)),
            TD::make('is_blocked', __('Status'))
                ->render(fn (User $user) => AdminTable::blocked((bool) $user->is_blocked)),
            TD::make('direct_team_count', __('Direct'))->align(TD::ALIGN_CENTER),
            TD::make(__('Actions'))->align(TD::ALIGN_CENTER)->width('110px')
                ->render(fn (User $user) => DropDown::make()->icon('bs.three-dots-vertical')->list([
                    Link::make(__('View full data'))
                        ->route('platform.data.user-full-data.show', $user->id)
                        ->icon('bs.eye'),
                    Link::make(__('Edit user'))
                        ->route('platform.systems.users.edit', $user->id)
                        ->icon('bs.pencil')
                        ->canSee(optional(request()->user())->hasAccess('platform.systems.users') === true),
                ])),
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
