<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Lending;

use App\Models\OnChainLendingPosition;
use App\Models\User;
use App\Orchid\Layouts\Lending\LendingUserListLayout;
use App\Services\Lending\LendingUserAccessService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class LendingUserListScreen extends Screen
{
    public function query(): iterable
    {
        $users = User::query()
            ->select('users.*')
            ->selectSub(
                OnChainLendingPosition::query()
                    ->selectRaw('COUNT(*)')
                    ->whereColumn('on_chain_lending_positions.wallet_address', 'users.wallet_address')
                    ->whereIn('status', ['Active', 'ACTIVE', '1']),
                'active_lending_positions'
            )
            ->selectSub(
                OnChainLendingPosition::query()
                    ->selectRaw('COALESCE(SUM(selected_amount), 0)')
                    ->whereColumn('on_chain_lending_positions.wallet_address', 'users.wallet_address'),
                'total_loan_amount'
            )
            ->whereNotNull('wallet_address')
            ->where('wallet_address', '!=', '')
            ->defaultSort('id', 'desc')
            ->paginate(25);

        return [
            'lending_users' => $users,
        ];
    }

    public function name(): ?string
    {
        return __('Lending users');
    }

    public function description(): ?string
    {
        return __('Block or unblock application-level Lending ID access (does not modify on-chain positions).');
    }

    public function permission(): ?iterable
    {
        return [
            'lending.user.block',
            'lending.user.unblock',
        ];
    }

    public function layout(): iterable
    {
        return [
            LendingUserListLayout::class,
            Layout::modal('blockLendingModal', Layout::rows([
                \Orchid\Screen\Fields\Input::make('block.user_id')->type('hidden'),
                \Orchid\Screen\Fields\Input::make('block.wallet_preview')->title(__('Wallet'))->readonly(),
                \Orchid\Screen\Fields\Input::make('block.active_positions_preview')->title(__('Active positions'))->readonly(),
                \Orchid\Screen\Fields\TextArea::make('block.reason')
                    ->title(__('Block reason'))
                    ->required()
                    ->rows(3),
            ]))
                ->title(__('Block Lending ID'))
                ->applyButton(__('Confirm block'))
                ->async('asyncBlockModal'),

            Layout::modal('unblockLendingModal', Layout::rows([
                \Orchid\Screen\Fields\Input::make('unblock.user_id')->type('hidden'),
                \Orchid\Screen\Fields\Input::make('unblock.wallet_preview')->title(__('Wallet'))->readonly(),
                \Orchid\Screen\Fields\TextArea::make('unblock.note')
                    ->title(__('Unblock note (optional)'))
                    ->rows(2),
            ]))
                ->title(__('Unblock Lending ID'))
                ->applyButton(__('Confirm unblock'))
                ->async('asyncUnblockModal'),
        ];
    }

    public function asyncBlockModal(User $user): iterable
    {
        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        $active = $wallet === ''
            ? 0
            : OnChainLendingPosition::query()->where('wallet_address', $wallet)->active()->count();

        return [
            'block' => [
                'user_id' => $user->id,
                'wallet_preview' => $user->wallet_address,
                'active_positions_preview' => (string) $active,
                'reason' => '',
            ],
        ];
    }

    public function asyncUnblockModal(User $user): iterable
    {
        return [
            'unblock' => [
                'user_id' => $user->id,
                'wallet_preview' => $user->wallet_address,
                'note' => '',
            ],
        ];
    }

    public function blockLendingUser(Request $request, LendingUserAccessService $service): RedirectResponse
    {
        $validated = $request->validate([
            'block.user_id' => ['required', 'integer', 'exists:users,id'],
            'block.reason' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        $target = User::query()->findOrFail((int) $validated['block']['user_id']);
        $admin = $request->user();

        try {
            $service->block($target, $admin, (string) $validated['block']['reason']);
        } catch (AuthorizationException|InvalidArgumentException $e) {
            Toast::error($e->getMessage());

            return redirect()->route('platform.lending.users');
        }

        Toast::info(__('Lending ID blocked for user #:id', ['id' => $target->id]));

        return redirect()->route('platform.lending.users');
    }

    public function unblockLendingUser(Request $request, LendingUserAccessService $service): RedirectResponse
    {
        $validated = $request->validate([
            'unblock.user_id' => ['required', 'integer', 'exists:users,id'],
            'unblock.note' => ['nullable', 'string', 'max:2000'],
        ]);

        $target = User::query()->findOrFail((int) $validated['unblock']['user_id']);
        $admin = $request->user();

        try {
            $service->unblock($target, $admin, $validated['unblock']['note'] ?? null);
        } catch (AuthorizationException $e) {
            Toast::error($e->getMessage());

            return redirect()->route('platform.lending.users');
        }

        Toast::info(__('Lending ID unblocked for user #:id', ['id' => $target->id]));

        return redirect()->route('platform.lending.users');
    }
}
