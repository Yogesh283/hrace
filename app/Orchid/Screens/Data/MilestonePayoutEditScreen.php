<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\MilestonePayout;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Concerns\ResolvesOrchidRouteModel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\Relation;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class MilestonePayoutEditScreen extends Screen
{
    use RequiresPlatformDataPermission;
    use ResolvesOrchidRouteModel;

    /** @var MilestonePayout */
    public $milestone_payout;

    public function query(): iterable
    {
        return [
            'milestone_payout' => $this->routeOrNew('milestone_payout', MilestonePayout::class),
        ];
    }

    public function name(): ?string
    {
        return $this->milestone_payout->exists ? __('Edit milestone payout') : __('New milestone payout');
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
                ->canSee($this->milestone_payout->exists),

            Button::make(__('Save'))
                ->icon('bs.check-circle')
                ->method('save'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::rows([
                Relation::make('milestone_payout.user_id')
                    ->fromModel(\App\Models\User::class, 'email')
                    ->title(__('User'))
                    ->required(),
                Input::make('milestone_payout.milestone_code')
                    ->title(__('Milestone code'))
                    ->maxlength(10)
                    ->required(),
            ]),
        ];
    }

    public function save(Request $request): RedirectResponse
    {
        $routeModel = $this->routeOrNew('milestone_payout', MilestonePayout::class);
        $milestonePayout = $routeModel->exists
            ? MilestonePayout::query()->findOrFail($routeModel->id)
            : new MilestonePayout();

        $codeUnique = Rule::unique('milestone_payouts', 'milestone_code')
            ->where('user_id', (int) $request->input('milestone_payout.user_id'));

        if ($milestonePayout->exists) {
            $codeUnique = $codeUnique->ignore($milestonePayout->id);
        }

        $data = $request->validate([
            'milestone_payout.user_id' => ['required', 'integer', 'exists:users,id'],
            'milestone_payout.milestone_code' => ['required', 'string', 'max:10', $codeUnique],
        ])['milestone_payout'];

        $milestonePayout->fill($data);
        $milestonePayout->save();

        Toast::info(__('Saved'));

        return redirect()->route('platform.data.milestone-payouts');
    }

    public function remove(): RedirectResponse
    {
        $this->routeOrNew('milestone_payout', MilestonePayout::class)->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.milestone-payouts');
    }
}
