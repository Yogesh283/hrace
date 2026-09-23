<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\User;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use App\Support\MemberCode;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\DropDown;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class TeamStructureListLayout extends AdminVipTable
{
    public $target = 'members';

    protected $title = 'Team structure';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->sort()->width('72px')
                ->render(fn (User $u) => AdminTable::id($u->id)),
            TD::make('member_code', __('Code'))
                ->render(fn (User $u) => '<span class="rx-admin-code">'.e(MemberCode::format($u->member_number)).'</span>'),
            TD::make('name', __('Member'))->sort()
                ->render(fn (User $u) => AdminTable::member($u->name, $u->email)),
            TD::make('level', __('Level'))->sort()->align(TD::ALIGN_CENTER)
                ->render(fn (User $u) => AdminTable::level((int) $u->level)),
            TD::make('is_blocked', __('Status'))
                ->render(fn (User $u) => AdminTable::blocked((bool) $u->is_blocked)),
            TD::make('withdrawals_disabled', __('Withdraw'))
                ->render(fn (User $u) => AdminTable::withdrawals($u->canRequestWithdrawal())),
            TD::make('referral_code', __('Ref code'))->render(fn (User $u) => AdminTable::text($u->referral_code)),
            TD::make('referred_by', __('Sponsor'))
                ->render(function (User $u) {
                    if ($u->referrer) {
                        return AdminTable::member($u->referrer->name, $u->referrer->email, $u->referrer->member_number);
                    }

                    return $u->joined_with_code
                        ? AdminTable::badge($u->joined_with_code, 'muted')
                        : AdminTable::text(null);
                }),
            TD::make('direct_team_count', __('Direct'))->sort()->align(TD::ALIGN_CENTER),
            TD::make(__('Edit'))->align(TD::ALIGN_CENTER)
                ->render(fn (User $u) => DropDown::make()->icon('bs.three-dots-vertical')->list([
                    Link::make(__('Open full data'))->icon('bs.person-lines-fill')->route('platform.data.user-full-data.show', $u->id),
                    Link::make(__('Open user'))->icon('bs.pencil')->route('platform.systems.users.edit', $u->id),
                    Button::make(__('Disable withdrawals'))
                        ->icon('bs.slash-circle')
                        ->confirm(__('Disable withdrawal requests for this member?'))
                        ->method('disableWithdrawals', ['id' => $u->id])
                        ->canSee($u->canRequestWithdrawal()),
                    Button::make(__('Enable withdrawals'))
                        ->icon('bs.check-circle')
                        ->confirm(__('Allow withdrawal requests for this member?'))
                        ->method('enableWithdrawals', ['id' => $u->id])
                        ->canSee(! $u->canRequestWithdrawal()),
                ])),
        ];
    }
}
