<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\User;

use App\Models\User;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\DropDown;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Actions\ModalToggle;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Layouts\Persona;
use Orchid\Screen\TD;

class UserListLayout extends AdminVipTable
{
    public $target = 'users';

    protected $title = 'Members';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (User $user) => AdminTable::id($user->id)),

            TD::make('member_number', __('Code'))
                ->render(fn (User $user) => '<span class="rx-admin-code">'.e($user->member_code).'</span>'),

            TD::make('name', __('Name'))->sort()->cantHide()->filter(Input::make())
                ->render(fn (User $user) => new Persona($user->presenter())),

            TD::make('email', __('Email'))->sort()->cantHide()->filter(Input::make())
                ->render(fn (User $user) => ModalToggle::make($user->email)
                    ->modal('editUserModal')
                    ->modalTitle($user->presenter()->title())
                    ->method('saveUser')
                    ->asyncParameters(['user' => $user->id])),

            TD::make('level', __('Level'))->sort()->align(TD::ALIGN_CENTER)
                ->render(fn (User $user) => AdminTable::level((int) $user->level)),

            TD::make('is_blocked', __('Status'))
                ->render(fn (User $user) => AdminTable::blocked((bool) $user->is_blocked)),

            TD::make('referred_by', __('Sponsor'))
                ->render(fn (User $user) => $user->referrer
                    ? AdminTable::member($user->referrer->name, $user->referrer->email)
                    : AdminTable::text($user->joined_with_code)),

            TD::make('direct_team_count', __('Direct'))->align(TD::ALIGN_CENTER),

            TD::make('balance_usd', __('Balance'))->sort()->align(TD::ALIGN_RIGHT)
                ->render(fn (User $user) => AdminTable::money($user->balance_usd)),

            TD::make('created_at', __('Joined'))->sort()->defaultHidden()
                ->render(fn (User $user) => AdminTable::dateTime($user->created_at)),

            TD::make(__('Actions'))->align(TD::ALIGN_CENTER)->width('110px')
                ->render(fn (User $user) => DropDown::make()->icon('bs.three-dots-vertical')->list([
                    Link::make(__('Full Data'))
                        ->route('platform.data.user-full-data.show', $user->id)
                        ->icon('bs.eye')
                        ->canSee(optional(request()->user())->hasAccess('platform.data') === true),
                    Link::make(__('Edit'))->route('platform.systems.users.edit', $user->id)->icon('bs.pencil'),
                    Button::make($user->is_blocked ? __('Unblock') : __('Block'))
                        ->icon($user->is_blocked ? 'bs.unlock' : 'bs.lock')
                        ->method('toggleBlock', ['id' => $user->id])
                        ->confirm($user->is_blocked ? __('Unblock user?') : __('Block user?')),
                    Button::make(__('Delete'))->icon('bs.trash3')
                        ->confirm(__('Delete user permanently?'))
                        ->method('remove', ['id' => $user->id]),
                ])),
        ];
    }
}
