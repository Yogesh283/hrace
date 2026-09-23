<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\Investment;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Concerns\ResolvesOrchidRouteModel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\DateTimer;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\Relation;
use Orchid\Screen\Fields\Select;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class InvestmentEditScreen extends Screen
{
    use RequiresPlatformDataPermission;
    use ResolvesOrchidRouteModel;

    /** @var Investment */
    public $investment;

    public function query(): iterable
    {
        return [
            'investment' => $this->routeOrNew('investment', Investment::class),
        ];
    }

    public function name(): ?string
    {
        return $this->investment->exists ? __('Edit investment') : __('New investment');
    }

    public function description(): ?string
    {
        return __('Prefer member Staking flow for new stakes. Admin edit is for corrections only.');
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
                ->canSee($this->investment->exists),

            Button::make(__('Save'))
                ->icon('bs.check-circle')
                ->method('save'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::rows([
                Relation::make('investment.user_id')
                    ->fromModel(\App\Models\User::class, 'email')
                    ->title(__('User'))
                    ->required(),
                Input::make('investment.amount_usd')
                    ->title(__('Amount USD'))
                    ->type('number')
                    ->step('0.01')
                    ->required(),
                Input::make('investment.duration_days')
                    ->title(__('Duration days (0 = Flexible)'))
                    ->type('number')
                    ->help(__('0 Flexible · 180 · 365 · 730 · 1095')),
                Input::make('investment.roi_percent_daily')
                    ->title(__('ROI % daily'))
                    ->type('number')
                    ->step('0.01'),
                Input::make('investment.roi_percent_monthly')
                    ->title(__('ROI % monthly (legacy)'))
                    ->type('number')
                    ->step('0.01'),
                Input::make('investment.roi_payouts_done')
                    ->title(__('ROI payouts done'))
                    ->type('number'),
                Input::make('investment.total_roi_paid_usd')
                    ->title(__('Total ROI paid USD'))
                    ->type('number')
                    ->step('0.01')
                    ->required(),
                Input::make('investment.cap_multiplier')
                    ->title(__('Cap multiplier'))
                    ->type('number')
                    ->step('0.01')
                    ->required(),
                Select::make('investment.status')
                    ->title(__('Status'))
                    ->options([
                        Investment::STATUS_ACTIVE => __('Active'),
                        Investment::STATUS_COMPLETED => __('Completed (awaiting unlock / rollover)'),
                        Investment::STATUS_UNLOCKING => __('Unlocking (EMI schedule)'),
                        Investment::STATUS_UNLOCKED => __('Unlocked'),
                    ])
                    ->required(),
                DateTimer::make('investment.next_roi_at')
                    ->title(__('Next ROI at'))
                    ->allowEmpty(),
                DateTimer::make('investment.holding_completed_at')
                    ->title(__('Holding completed at'))
                    ->allowEmpty(),
                Input::make('investment.rollover_count')
                    ->title(__('Rollover count'))
                    ->type('number'),
            ]),
        ];
    }

    public function save(Request $request): RedirectResponse
    {
        $routeModel = $this->routeOrNew('investment', Investment::class);
        $investment = $routeModel->exists
            ? Investment::query()->findOrFail($routeModel->id)
            : new Investment;

        $data = $request->validate([
            'investment.user_id' => ['required', 'integer', 'exists:users,id'],
            'investment.amount_usd' => ['required', 'numeric'],
            'investment.duration_days' => ['nullable', 'integer', 'min:0'],
            'investment.roi_percent_daily' => ['nullable', 'numeric'],
            'investment.roi_percent_monthly' => ['nullable', 'numeric'],
            'investment.roi_payouts_done' => ['nullable', 'integer', 'min:0'],
            'investment.total_roi_paid_usd' => ['required', 'numeric'],
            'investment.cap_multiplier' => ['required', 'numeric'],
            'investment.status' => [
                'required',
                'string',
                Rule::in([
                    Investment::STATUS_ACTIVE,
                    Investment::STATUS_COMPLETED,
                    Investment::STATUS_UNLOCKING,
                    Investment::STATUS_UNLOCKED,
                ]),
            ],
            'investment.next_roi_at' => ['nullable', 'date'],
            'investment.holding_completed_at' => ['nullable', 'date'],
            'investment.rollover_count' => ['nullable', 'integer', 'min:0'],
        ])['investment'];

        $investment->fill($data);
        $investment->save();

        Toast::info(__('Saved'));

        return redirect()->route('platform.data.investments');
    }

    public function remove(): RedirectResponse
    {
        $this->routeOrNew('investment', Investment::class)->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.investments');
    }
}
