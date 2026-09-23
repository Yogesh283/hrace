<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Role;

use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Platform\Models\Role;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\TD;

class RoleListLayout extends AdminVipTable
{
    public $target = 'roles';

    protected $title = 'Roles';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (Role $role) => AdminTable::id($role->id)),

            TD::make('name', __('Name'))->sort()->cantHide()->filter(Input::make())
                ->render(fn (Role $role) => Link::make($role->name)
                    ->route('platform.systems.roles.edit', $role->id)),

            TD::make('slug', __('Slug'))->sort()->cantHide()->filter(Input::make())
                ->render(fn (Role $role) => AdminTable::badge($role->slug, 'vip')),

            TD::make('created_at', __('Created'))->sort()->defaultHidden()
                ->render(fn (Role $role) => AdminTable::dateTime($role->created_at)),

            TD::make('updated_at', __('Updated'))->sort()
                ->render(fn (Role $role) => AdminTable::dateTime($role->updated_at)),
        ];
    }
}
