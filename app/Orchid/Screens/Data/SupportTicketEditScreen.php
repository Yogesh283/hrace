<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\SupportTicket;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Concerns\ResolvesOrchidRouteModel;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Fields\Input;
use Orchid\Screen\Fields\Select;
use Orchid\Screen\Fields\TextArea;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;
use Orchid\Support\Facades\Toast;

class SupportTicketEditScreen extends Screen
{
    use RequiresPlatformDataPermission;
    use ResolvesOrchidRouteModel;

    /** @var SupportTicket */
    public $support_ticket;

    public function query(): iterable
    {
        $ticket = $this->routeOrNew('support_ticket', SupportTicket::class);
        if ($ticket->exists) {
            $ticket = SupportTicket::query()->with('user:id,name,email,member_number')->findOrFail($ticket->id);
        }

        return [
            'support_ticket' => $ticket,
        ];
    }

    public function name(): ?string
    {
        return $this->support_ticket->exists
            ? __('Ticket :token', ['token' => $this->support_ticket->token])
            : __('Support ticket');
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
                ->canSee($this->support_ticket->exists),
        ];
    }

    public function layout(): iterable
    {
        $statusOptions = SupportTicket::statusLabels();

        return [
            Layout::rows([
                Input::make('support_ticket.token')
                    ->title(__('Token'))
                    ->readonly(),
                Input::make('support_ticket.subject')
                    ->title(__('Subject'))
                    ->readonly(),
                TextArea::make('support_ticket.message')
                    ->title(__('Member message'))
                    ->rows(8)
                    ->readonly(),
                Select::make('support_ticket.status')
                    ->title(__('Status'))
                    ->options($statusOptions)
                    ->required(),
                TextArea::make('support_ticket.admin_notes')
                    ->title(__('Admin notes'))
                    ->rows(4)
                    ->help(__('Internal notes — not shown to the member on the support page.')),
            ]),
        ];
    }

    public function save(Request $request): RedirectResponse
    {
        $ticket = SupportTicket::query()->findOrFail($this->support_ticket->id);

        $data = $request->validate([
            'support_ticket.status' => ['required', 'string', 'in:'.implode(',', array_keys(SupportTicket::statusLabels()))],
            'support_ticket.admin_notes' => ['nullable', 'string', 'max:5000'],
        ])['support_ticket'];

        $ticket->fill($data)->save();

        Toast::info(__('Ticket updated.'));

        return redirect()->route('platform.data.support-tickets');
    }
}
