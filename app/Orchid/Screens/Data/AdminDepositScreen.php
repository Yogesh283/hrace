<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Support\AdminTable;
use App\Services\Income\LedgerWriter;
use App\Services\Income\WalletBalanceService;
use App\Support\MemberCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\TextArea;
use Orchid\Screen\Screen;
use Orchid\Screen\TD;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class AdminDepositScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        return [
            'recent_deposits' => LedgerEntry::query()
                ->where('entry_type', LedgerEntry::TYPE_WALLET_DEPOSIT)
                ->where('reference_type', 'admin_deposit')
                ->with('user:id,name,email,member_number')
                ->latest('id')
                ->limit(25)
                ->get(),
        ];
    }

    public function name(): ?string
    {
        return __('Admin deposit');
    }

    public function description(): ?string
    {
        return __('Add deposit amount to member current balance (old balance + deposit = new balance). No upper limit.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Button::make(__('Credit deposit'))
                ->icon('bs.plus-circle')
                ->confirm(__('Credit this deposit to the member wallet?'))
                ->method('deposit'),
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
                    ->help(__('Find the numeric ID in Users or Team structure.')),
                Input::make('amount_usd')
                    ->title(__('Add deposit amount (USD)'))
                    ->type('number')
                    ->step('0.01')
                    ->required()
                    ->help(__('Added to current balance. Example: old $100 + deposit $50 = new $150.')),
                TextArea::make('note')
                    ->title(__('Note (optional)'))
                    ->rows(2)
                    ->maxlength(500)
                    ->help(__('Saved in ledger meta for audit trail.')),
            ])->title(__('New deposit')),

            Layout::table('recent_deposits', [
                TD::make('id', __('ID'))->width('72px')
                    ->render(fn (LedgerEntry $entry) => AdminTable::id($entry->id)),
                TD::make('user_id', __('Member'))
                    ->render(fn (LedgerEntry $entry) => AdminTable::member(
                        $entry->user?->name,
                        $entry->user?->email,
                        $entry->user?->member_number,
                    )),
                TD::make('amount_usd', __('Amount'))->align(TD::ALIGN_RIGHT)
                    ->render(fn (LedgerEntry $entry) => AdminTable::money($entry->amount_usd)),
                TD::make('balance_after_usd', __('Balance after'))->align(TD::ALIGN_RIGHT)
                    ->render(fn (LedgerEntry $entry) => AdminTable::money($entry->balance_after_usd)),
                TD::make('created_at', __('When'))
                    ->render(fn (LedgerEntry $entry) => AdminTable::dateTime($entry->created_at)),
            ])->title(__('Recent admin deposits')),
        ];
    }

    public function deposit(Request $request, LedgerWriter $ledger, WalletBalanceService $wallets): RedirectResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'amount_usd' => ['required', 'numeric', 'min:0.01'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $amount = number_format((float) $validated['amount_usd'], 2, '.', '');
        $user = User::query()->findOrFail((int) $validated['user_id']);
        $oldBalance = $wallets->currentBalance($user);

        try {
            DB::transaction(function () use ($user, $amount, $validated, $ledger, $oldBalance): void {
                $ledger->record(
                    $user,
                    LedgerEntry::TYPE_WALLET_DEPOSIT,
                    $amount,
                    'admin_deposit',
                    auth()->id(),
                    array_filter([
                        'admin_deposit' => true,
                        'admin_user_id' => auth()->id(),
                        'previous_balance_usd' => $oldBalance,
                        'note' => $validated['note'] ?? null,
                    ]),
                );
            });
        } catch (\Throwable $e) {
            report($e);
            Toast::error(__('Deposit failed. Please try again.'));

            return redirect()->route('platform.data.admin-deposit');
        }

        $newBalance = $wallets->currentBalance($user->fresh());

        Toast::info(__('Old balance $:old + deposit $:added = new balance $:new for :member (:email).', [
            'old' => $oldBalance,
            'added' => $amount,
            'new' => $newBalance,
            'member' => MemberCode::format($user->member_number),
            'email' => $user->email,
        ]));

        return redirect()->route('platform.data.admin-deposit');
    }
}
