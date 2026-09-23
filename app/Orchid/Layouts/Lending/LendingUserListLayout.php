<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Lending;

use App\Models\User;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\ModalToggle;
use Orchid\Screen\TD;

class LendingUserListLayout extends AdminVipTable
{
    public $target = 'lending_users';

    protected $title = 'Lending user management';

    public function columns(): array
    {
        return [
            TD::make('id', __('User ID'))->sort()->width('80px')
                ->render(fn (User $user) => AdminTable::id($user->id)),

            TD::make('name', __('Name'))->sort()
                ->render(fn (User $user) => AdminTable::text($user->name)),

            TD::make('wallet_address', __('Wallet Address'))
                ->render(fn (User $user) => AdminTable::mono($user->wallet_address)),

            TD::make('active_lending_positions', __('Active Lending Positions'))->align(TD::ALIGN_CENTER)
                ->render(fn (User $user) => AdminTable::text((string) ($user->active_lending_positions ?? 0))),

            TD::make('total_loan_amount', __('Total Loan Amount'))->align(TD::ALIGN_RIGHT)
                ->render(fn (User $user) => AdminTable::money($user->total_loan_amount ?? 0)),

            TD::make('lending_user_status', __('Lending Status'))
                ->render(fn (User $user) => AdminTable::lendingStatus((string) $user->lending_user_status)),

            TD::make('lending_block_reason', __('Block Reason'))
                ->render(fn (User $user) => AdminTable::text($user->lending_block_reason ?: '—')),

            TD::make('lending_blocked_at', __('Blocked At'))
                ->render(fn (User $user) => AdminTable::dateTime($user->lending_blocked_at)),

            TD::make('lending_blocked_by', __('Blocked By'))
                ->render(fn (User $user) => $user->lending_blocked_by
                    ? AdminTable::id((int) $user->lending_blocked_by)
                    : AdminTable::text('—')),

            TD::make(__('Actions'))->align(TD::ALIGN_CENTER)->width('160px')
                ->render(function (User $user) {
                    $admin = request()->user();
                    $blocked = $user->lending_user_status === User::LENDING_STATUS_BLOCKED;

                    if ($blocked) {
                        return ModalToggle::make(__('Unblock Lending ID'))
                            ->icon('bs.unlock')
                            ->modal('unblockLendingModal')
                            ->method('unblockLendingUser')
                            ->asyncParameters(['user' => $user->id])
                            ->canSee($admin?->hasAccess('lending.user.unblock') === true);
                    }

                    return ModalToggle::make(__('Block Lending ID'))
                        ->icon('bs.lock')
                        ->modal('blockLendingModal')
                        ->method('blockLendingUser')
                        ->asyncParameters(['user' => $user->id])
                        ->canSee($admin?->hasAccess('lending.user.block') === true);
                }),
        ];
    }
}
