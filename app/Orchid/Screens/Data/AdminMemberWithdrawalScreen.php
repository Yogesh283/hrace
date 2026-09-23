<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\User;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Support\MemberCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\CheckBox;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\Label;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class AdminMemberWithdrawalScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(Request $request): iterable
    {
        $userId = $request->integer('user_id');
        $user = $userId > 0 ? User::query()->find($userId) : null;

        return [
            'user_id' => $user?->id,
            'withdrawals_disabled' => $user ? (bool) $user->withdrawals_disabled : false,
            'member_preview' => $user
                ? MemberCode::format($user->member_number).' · '.$user->email.' · '.($user->canRequestWithdrawal() ? __('withdrawals allowed') : __('withdrawals disabled'))
                : __('Enter a user ID and click Load status.'),
        ];
    }

    public function name(): ?string
    {
        return __('Member withdrawals');
    }

    public function description(): ?string
    {
        return __('Enable or disable withdrawal requests for any member by user ID. Load status first, then save.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Button::make(__('Load status'))
                ->icon('bs.search')
                ->method('load'),
            Button::make(__('Save'))
                ->icon('bs.check-circle')
                ->method('save'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::rows([
                Input::make('user_id')
                    ->title(__('Member user ID'))
                    ->type('number')
                    ->required()
                    ->help(__('Find the numeric ID in Users, Team structure, or User Full Data.')),
                Label::make('member_preview')
                    ->title(__('Current status')),
                CheckBox::make('withdrawals_disabled')
                    ->title(__('Disable withdrawals'))
                    ->placeholder(__('When checked, member cannot submit withdrawal requests'))
                    ->sendTrueOrFalse(),
                Label::make('hint')
                    ->title(__('Note'))
                    ->value(__('Uncheck to allow withdrawals again. This does not affect pending withdrawal approvals.')),
            ]),
        ];
    }

    public function load(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        return redirect()->route('platform.data.member-withdrawals', [
            'user_id' => (int) $validated['user_id'],
        ]);
    }

    public function save(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'withdrawals_disabled' => ['nullable', 'boolean'],
        ]);

        $user = User::query()->findOrFail((int) $validated['user_id']);
        $disabled = (bool) ($validated['withdrawals_disabled'] ?? false);

        $user->forceFill(['withdrawals_disabled' => $disabled])->save();

        Toast::info($disabled
            ? __('Withdrawals disabled for :member (:email).', [
                'member' => MemberCode::format($user->member_number),
                'email' => $user->email,
            ])
            : __('Withdrawals enabled for :member (:email).', [
                'member' => MemberCode::format($user->member_number),
                'email' => $user->email,
            ]));

        return redirect()->route('platform.data.member-withdrawals', [
            'user_id' => $user->id,
        ]);
    }
}
