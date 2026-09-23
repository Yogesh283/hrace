<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\User;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class UserFullDataDirectReferralsLayout extends AdminVipTable
{
    public $target = 'direct_referrals';

    protected $title = 'Direct referral children';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (User $user) => AdminTable::id($user->id)),
            TD::make('member_number', __('Member'))
                ->render(fn (User $user) => AdminTable::member($user->name, $user->email, $user->member_number)),
            TD::make('referral_code', __('Referral code'))
                ->render(fn (User $user) => AdminTable::text($user->referral_code)),
            TD::make('wallet_address', __('Wallet'))
                ->render(fn (User $user) => $this->shortCode($user->wallet_address)),
            TD::make('level', __('Level'))->align(TD::ALIGN_CENTER)
                ->render(fn (User $user) => AdminTable::level((int) $user->level)),
            TD::make('is_blocked', __('Status'))
                ->render(fn (User $user) => AdminTable::blocked((bool) $user->is_blocked)),
            TD::make('id_activated_at', __('Activated'))
                ->render(fn (User $user) => AdminTable::dateTime($user->id_activated_at)),
            TD::make(__('Actions'))->align(TD::ALIGN_RIGHT)
                ->render(fn (User $user) => Link::make(__('View full data'))
                    ->route('platform.data.user-full-data.show', $user->id)
                    ->icon('bs.eye')),
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
