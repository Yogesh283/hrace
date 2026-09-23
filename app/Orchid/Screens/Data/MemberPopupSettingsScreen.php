<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\SiteSetting;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\CheckBox;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\TextArea;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class MemberPopupSettingsScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        return [
            'enabled' => in_array(strtolower((string) SiteSetting::get(SiteSetting::KEY_MEMBER_POPUP_ENABLED, '0')), ['1', 'true', 'yes', 'on'], true),
            'title' => SiteSetting::get(SiteSetting::KEY_MEMBER_POPUP_TITLE, ''),
            'message' => SiteSetting::get(SiteSetting::KEY_MEMBER_POPUP_MESSAGE, ''),
        ];
    }

    public function name(): ?string
    {
        return __('Member popup');
    }

    public function description(): ?string
    {
        return __('Show a modal popup to members across the site. Controlled by site_settings keys.');
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
                CheckBox::make('enabled')
                    ->title(__('Enable popup'))
                    ->placeholder(__('Show popup to all members'))
                    ->sendTrueOrFalse()
                    ->help(__('site_settings.key = member_popup_enabled')),
                Input::make('title')
                    ->title(__('Popup title'))
                    ->maxlength(120)
                    ->help(__('site_settings.key = member_popup_title')),
                TextArea::make('message')
                    ->title(__('Popup message'))
                    ->rows(6)
                    ->help(__('site_settings.key = member_popup_message')),
            ]),
        ];
    }

    public function save(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'enabled' => ['nullable', 'boolean'],
            'title' => ['nullable', 'string', 'max:120'],
            'message' => ['nullable', 'string', 'max:5000'],
        ]);

        SiteSetting::set(
            SiteSetting::KEY_MEMBER_POPUP_ENABLED,
            ($data['enabled'] ?? false) ? '1' : '0',
        );
        SiteSetting::set(
            SiteSetting::KEY_MEMBER_POPUP_TITLE,
            isset($data['title']) ? (string) $data['title'] : null,
        );
        SiteSetting::set(
            SiteSetting::KEY_MEMBER_POPUP_MESSAGE,
            isset($data['message']) ? (string) $data['message'] : null,
        );

        Toast::info(__('Popup settings saved.'));

        return redirect()->route('platform.data.member-popup');
    }
}

