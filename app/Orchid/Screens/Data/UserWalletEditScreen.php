<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\User;
use App\Models\UserWallet;
use App\Models\LedgerEntry;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Concerns\ResolvesOrchidRouteModel;
use App\Services\Income\LedgerWriter;
use App\Services\Income\WalletBalanceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\Label;
use Orchid\Screen\Fields\Relation;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class UserWalletEditScreen extends Screen
{
    use RequiresPlatformDataPermission;
    use ResolvesOrchidRouteModel;

    /** @var UserWallet */
    public $user_wallet;

    public string $current_balance_usd = '0.00';

    public string $current_race_coin_balance = '0.0000';

    public function query(WalletBalanceService $wallets): iterable
    {
        $userWallet = $this->routeOrNew('user_wallet', UserWallet::class);
        if ($userWallet->exists) {
            $userWallet->load('user');
        }

        $currentBalance = '0.00';
        $currentRaceCoin = '0.0000';
        if ($userWallet->exists && $userWallet->user) {
            $currentBalance = $wallets->currentBalance($userWallet->user);
            $currentRaceCoin = number_format((float) ($userWallet->race_coin_balance ?? 0), 4, '.', '');
        }

        return [
            'user_wallet' => $userWallet,
            'current_balance_usd' => $currentBalance,
            'current_race_coin_balance' => $currentRaceCoin,
        ];
    }

    public function name(): ?string
    {
        return $this->user_wallet->exists ? __('Edit user wallet') : __('New user wallet');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Button::make(__('Remove'))
                ->icon('bs.trash3')
                ->confirm(__('Delete this row?'))
                ->method('remove')
                ->canSee($this->user_wallet->exists),

            Button::make(__('Add deposit'))
                ->icon('bs.plus-circle')
                ->method('save'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::rows([
                Relation::make('user_wallet.user_id')
                    ->fromModel(User::class, 'email')
                    ->title(__('User'))
                    ->required(),
                Label::make('current_balance_usd')
                    ->title(__('Current balance (USD)'))
                    ->value('$'.$this->current_balance_usd),
                Label::make('current_race_coin_balance')
                    ->title(__('Race Coin balance'))
                    ->value($this->current_race_coin_balance.' RC'),
                Input::make('deposit_amount_usd')
                    ->title(__('Add deposit (USD)'))
                    ->type('number')
                    ->step('0.01')
                    ->help(__('Added to current balance. Example: $100 + $50 deposit = $150 new balance.')),
            ]),
        ];
    }

    public function save(Request $request, LedgerWriter $ledger, WalletBalanceService $wallets): RedirectResponse
    {
        $routeModel = $this->routeOrNew('user_wallet', UserWallet::class);
        $userWallet = $routeModel->exists
            ? UserWallet::query()->findOrFail($routeModel->id)
            : new UserWallet();

        $userUnique = Rule::unique('user_wallets', 'user_id');
        if ($userWallet->exists) {
            $userUnique = $userUnique->ignore($userWallet->id);
        }

        $validated = $request->validate([
            'user_wallet.user_id' => ['required', 'integer', 'exists:users,id', $userUnique],
            'deposit_amount_usd' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        $userId = (int) $validated['user_wallet']['user_id'];
        $user = User::query()->findOrFail($userId);
        $depositAmount = $validated['deposit_amount_usd'] ?? null;

        if ($depositAmount === null || $depositAmount === '') {
            $wallet = UserWallet::query()->firstOrCreate(
                ['user_id' => $userId],
                ['balance_usd' => $wallets->currentBalance($user)],
            );

            Toast::warning(__('Enter a deposit amount to add to the current balance.'));

            return redirect()->route('platform.data.user-wallets.edit', $wallet->id);
        }

        $amount = number_format((float) $depositAmount, 2, '.', '');
        $oldBalance = $wallets->currentBalance($user);

        DB::transaction(function () use ($user, $amount, $ledger, $oldBalance): void {
            $ledger->record(
                $user,
                LedgerEntry::TYPE_WALLET_DEPOSIT,
                $amount,
                'admin_wallet_adjustment',
                auth()->id(),
                [
                    'admin_adjustment' => true,
                    'admin_user_id' => auth()->id(),
                    'previous_balance_usd' => $oldBalance,
                ],
            );
        });

        $newBalance = $wallets->currentBalance($user->fresh());

        Toast::info(__('Old balance $:old + deposit $:added = new balance $:new.', [
            'old' => $oldBalance,
            'added' => $amount,
            'new' => $newBalance,
        ]));

        $walletId = UserWallet::query()->where('user_id', $userId)->value('id');

        return redirect()->route('platform.data.user-wallets.edit', $walletId);
    }

    public function remove(): RedirectResponse
    {
        $this->routeOrNew('user_wallet', UserWallet::class)->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.user-wallets');
    }
}
