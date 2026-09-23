<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\SiteSetting;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class TreasurySettingsScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $fromDb = SiteSetting::get(SiteSetting::KEY_ADDRESS);
        $networkFromDb = SiteSetting::get(SiteSetting::KEY_NETWORK_LABEL);

        return [
            'address' => SiteSetting::treasuryAddress(),
            'network_label' => SiteSetting::treasuryNetworkLabel(),
            'using_env_fallback' => ! is_string($fromDb) || trim($fromDb) === '',
            'using_env_network_fallback' => ! is_string($networkFromDb) || trim($networkFromDb) === '',
        ];
    }

    public function name(): ?string
    {
        return __('Treasury deposit address');
    }

    public function description(): ?string
    {
        return __('Saved to site_settings in the database. Members and deposit verification use this address immediately after you save.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Button::make(__('Save'))
                ->icon('bs.check-circle')
                ->method('save'),
        ];
    }

    public function layout(): iterable
    {
        return [
            Layout::rows([
                Input::make('address')
                    ->title(__('Deposit address'))
                    ->placeholder('0x…')
                    ->maxlength(255)
                    ->required()
                    ->help(__('Stored in site_settings (key: address). Shown on the member Deposit page and used for on-chain verification.')),
                Input::make('network_label')
                    ->title(__('Network label'))
                    ->placeholder('BEP20 (BNB Smart Chain)')
                    ->maxlength(120)
                    ->required()
                    ->help(__('Stored in site_settings (key: network_label).')),
            ]),
        ];
    }

    public function save(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'address' => ['required', 'string', 'max:255', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'network_label' => ['required', 'string', 'max:120'],
        ]);

        SiteSetting::set(
            SiteSetting::KEY_ADDRESS,
            trim((string) $data['address']),
        );
        SiteSetting::set(
            SiteSetting::KEY_NETWORK_LABEL,
            trim((string) $data['network_label']),
        );

        Toast::info(__('Treasury settings saved. Deposit page will use the new address from the database.'));

        return redirect()->route('platform.data.treasury');
    }
}
