<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\User;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\TeamStructureListLayout;
use App\Support\MemberCode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Toast;

class TeamStructureListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();

        $q = User::query()
            ->with(['referrer:id,name,email,member_number,referral_code,level'])
            ->withCount('referrals as direct_team_count');

        if ($this->search !== '') {
            $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $this->search).'%';
            $q->where(function (Builder $inner) use ($like): void {
                $inner->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('member_number', 'like', $like)
                    ->orWhere('referral_code', 'like', $like);
                if (ctype_digit($this->search)) {
                    $inner->orWhere('id', (int) $this->search)
                        ->orWhere('referred_by', (int) $this->search);
                }
            });
        }

        return [
            'search' => $this->search,
            'members' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
        ];
    }

    public function name(): ?string
    {
        return __('Team structure');
    }

    public function description(): ?string
    {
        return __('Who sponsored whom (referral level plan), member level, and direct team size.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return $this->searchCommandBar('platform.data.team');
    }

    public function layout(): iterable
    {
        return [
            AdminListSearchLayout::class,
            TeamStructureListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.team';
    }

    public function disableWithdrawals(Request $request): RedirectResponse
    {
        $user = User::query()->findOrFail($request->integer('id'));
        $user->forceFill(['withdrawals_disabled' => true])->save();

        Toast::info(__('Withdrawals disabled for :member.', [
            'member' => MemberCode::format($user->member_number),
        ]));

        return redirect()->route('platform.data.team');
    }

    public function enableWithdrawals(Request $request): RedirectResponse
    {
        $user = User::query()->findOrFail($request->integer('id'));
        $user->forceFill(['withdrawals_disabled' => false])->save();

        Toast::info(__('Withdrawals enabled for :member.', [
            'member' => MemberCode::format($user->member_number),
        ]));

        return redirect()->route('platform.data.team');
    }
}
