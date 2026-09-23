<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\LedgerEntry;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Concerns\ResolvesOrchidRouteModel;
use App\Support\IncomeCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\Relation;
use Orchid\Screen\Fields\Select;
use Orchid\Screen\Fields\TextArea;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;
use ReflectionClass;

class LedgerEntryEditScreen extends Screen
{
    use RequiresPlatformDataPermission;
    use ResolvesOrchidRouteModel;

    /** @var LedgerEntry */
    public $ledger_entry;

    public function query(): iterable
    {
        $ledgerEntry = $this->routeOrNew('ledger_entry', LedgerEntry::class);
        if ($ledgerEntry->exists) {
            $ledgerEntry = LedgerEntry::query()->withoutCasts()->findOrFail($ledgerEntry->id);
        }

        return [
            'ledger_entry' => $ledgerEntry,
        ];
    }

    public function name(): ?string
    {
        return $this->ledger_entry->exists ? __('Edit ledger entry') : __('New ledger entry');
    }

    public function description(): ?string
    {
        return __('Prefer Admin Deposit / Withdrawal approval for balance changes. Manual ledger edits can desync wallet totals.');
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
                ->canSee($this->ledger_entry->exists),

            Button::make(__('Save'))
                ->icon('bs.check-circle')
                ->method('save'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::rows([
                Relation::make('ledger_entry.user_id')
                    ->fromModel(\App\Models\User::class, 'email')
                    ->title(__('User'))
                    ->required(),
                Select::make('ledger_entry.entry_type')
                    ->title(__('Entry type'))
                    ->options($this->entryTypeOptions())
                    ->required(),
                Input::make('ledger_entry.amount_usd')
                    ->title(__('Amount USD'))
                    ->type('number')
                    ->step('0.01')
                    ->required(),
                Input::make('ledger_entry.balance_after_usd')
                    ->title(__('Balance after USD'))
                    ->type('number')
                    ->step('0.01')
                    ->required(),
                Input::make('ledger_entry.reference_type')
                    ->title(__('Reference type'))
                    ->maxlength(40),
                Input::make('ledger_entry.reference_id')
                    ->title(__('Reference id'))
                    ->type('number'),
                TextArea::make('ledger_entry.meta')
                    ->title(__('Meta (JSON)'))
                    ->rows(4)
                    ->help(__('Leave empty or valid JSON object/array.')),
            ]),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function entryTypeOptions(): array
    {
        $ref = new ReflectionClass(LedgerEntry::class);
        $options = [];

        foreach ($ref->getConstants() as $name => $value) {
            if (! is_string($value) || ! str_starts_with((string) $name, 'TYPE_')) {
                continue;
            }
            $label = IncomeCatalog::labelForType($value);
            $options[$value] = $label !== $value ? "{$label} ({$value})" : $value;
        }

        ksort($options);

        return $options;
    }

    public function save(Request $request): RedirectResponse
    {
        $routeModel = $this->routeOrNew('ledger_entry', LedgerEntry::class);
        $ledgerEntry = $routeModel->exists
            ? LedgerEntry::query()->findOrFail($routeModel->id)
            : new LedgerEntry;

        $validated = $request->validate([
            'ledger_entry.user_id' => ['required', 'integer', 'exists:users,id'],
            'ledger_entry.entry_type' => ['required', 'string', 'max:40'],
            'ledger_entry.amount_usd' => ['required', 'numeric'],
            'ledger_entry.balance_after_usd' => ['required', 'numeric'],
            'ledger_entry.reference_type' => ['nullable', 'string', 'max:40'],
            'ledger_entry.reference_id' => ['nullable', 'integer'],
            'ledger_entry.meta' => ['nullable', 'string'],
        ]);

        $row = $validated['ledger_entry'];
        if (array_key_exists('meta', $row)) {
            $meta = $row['meta'];
            $row['meta'] = ($meta === null || $meta === '')
                ? null
                : json_decode((string) $meta, true, 512, JSON_THROW_ON_ERROR);
        }

        $ledgerEntry->fill($row);
        $ledgerEntry->save();

        Toast::info(__('Saved'));

        return redirect()->route('platform.data.ledger-entries');
    }

    public function remove(): RedirectResponse
    {
        $this->routeOrNew('ledger_entry', LedgerEntry::class)->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.ledger-entries');
    }
}
