<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\Withdrawal;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Concerns\ResolvesOrchidRouteModel;
use App\Services\Income\WithdrawalService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\Select;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class WithdrawalEditScreen extends Screen
{
    use RequiresPlatformDataPermission;
    use ResolvesOrchidRouteModel;

    /** @var Withdrawal */
    public $withdrawal;

    public function query(): iterable
    {
        $withdrawal = $this->routeOrNew('withdrawal', Withdrawal::class);
        if ($withdrawal->exists) {
            $withdrawal = Withdrawal::query()
                ->with('user:id,name,email,member_number')
                ->findOrFail($withdrawal->id);
        }

        return [
            'withdrawal' => $withdrawal,
        ];
    }

    public function name(): ?string
    {
        return $this->withdrawal->exists ? __('Edit withdrawal') : __('Withdrawal');
    }

    public function description(): ?string
    {
        return __('Set status to Completed to approve (debit wallet + pay fee). Rejected cancels the request.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Button::make(__('Save'))
                ->icon('bs.check-circle')
                ->method('save')
                ->canSee($this->withdrawal->exists),
        ];
    }

    public function layout(): iterable
    {
        $userLabel = '';
        if ($this->withdrawal->exists && $this->withdrawal->user) {
            $userLabel = trim(($this->withdrawal->user->name ?? '').' · '.($this->withdrawal->user->email ?? ''));
        }

        return [
            Layout::rows([
                Input::make('withdrawal.id')->title(__('ID'))->readonly(),
                Input::make('withdrawal.user_id')->title(__('User ID'))->readonly(),
                Input::make('member_label')
                    ->title(__('Member'))
                    ->value($userLabel !== '' ? $userLabel : '—')
                    ->readonly()
                    ->canSee($userLabel !== ''),
                Input::make('withdrawal.amount_usd')->title(__('Gross'))->readonly(),
                Input::make('withdrawal.team_reward_usd')->title(__('Team Reward (10%)'))->readonly(),
                Input::make('withdrawal.admin_fee_usd')->title(__('Admin Fee ($1 / 1%)'))->readonly(),
                Input::make('withdrawal.fee_usd')->title(__('Fee (Team Rewards legacy)'))->readonly(),
                Input::make('withdrawal.net_usd')->title(__('Net'))->readonly(),
                Input::make('withdrawal.destination_address')->title(__('Destination address'))->readonly(),
                Select::make('withdrawal.status')
                    ->title(__('Status'))
                    ->options(Withdrawal::statusLabels())
                    ->required(),
            ]),
        ];
    }

    public function save(Request $request): RedirectResponse
    {
        $withdrawal = Withdrawal::query()->findOrFail($this->withdrawal->id);
        $previousStatus = (string) $withdrawal->status;

        $allowed = implode(',', array_keys(Withdrawal::statusLabels()));
        $data = $request->validate([
            'withdrawal.status' => ['required', 'string', 'in:'.$allowed],
        ])['withdrawal'];

        $nextStatus = (string) $data['status'];

        try {
            if ($nextStatus === Withdrawal::STATUS_COMPLETED) {
                app(WithdrawalService::class)->approve($withdrawal);
                Toast::info(__('Withdrawal approved and wallet debited.'));
            } elseif ($nextStatus === Withdrawal::STATUS_REJECTED) {
                app(WithdrawalService::class)->reject($withdrawal);
                Toast::info(__('Withdrawal rejected.'));
            } elseif ($previousStatus !== $nextStatus) {
                $withdrawal->forceFill(['status' => $nextStatus])->save();
                Toast::info(__('Withdrawal updated.'));
            } else {
                Toast::info(__('No changes.'));
            }
        } catch (ValidationException $e) {
            $message = collect($e->errors())->flatten()->first() ?: __('Could not update withdrawal.');
            Toast::error($message);

            return redirect()->route('platform.data.withdrawals.edit', $withdrawal);
        } catch (\Throwable $e) {
            report($e);
            Toast::error(__('Could not update withdrawal: :message', ['message' => $e->getMessage()]));

            return redirect()->route('platform.data.withdrawals.edit', $withdrawal);
        }

        return redirect()->route('platform.data.withdrawals');
    }
}
