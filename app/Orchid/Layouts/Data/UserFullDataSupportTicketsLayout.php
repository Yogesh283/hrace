<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\SupportTicket;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Illuminate\Support\Str;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class UserFullDataSupportTicketsLayout extends AdminVipTable
{
    public $target = 'support_tickets';

    protected $title = 'Latest support tickets';

    public function columns(): array
    {
        return [
            TD::make('id', __('ID'))->width('72px')
                ->render(fn (SupportTicket $ticket) => AdminTable::id($ticket->id)),
            TD::make('token', __('Ticket'))
                ->render(fn (SupportTicket $ticket) => '<span class="rx-admin-code">'.e($ticket->token).'</span>'),
            TD::make('subject', __('Subject'))
                ->render(fn (SupportTicket $ticket) => e(Str::limit((string) $ticket->subject, 70))),
            TD::make('message', __('Message'))
                ->render(fn (SupportTicket $ticket) => e(Str::limit((string) $ticket->message, 120))),
            TD::make('status', __('Status'))
                ->render(fn (SupportTicket $ticket) => AdminTable::badge(
                    SupportTicket::statusLabels()[$ticket->status] ?? (string) $ticket->status,
                    match ($ticket->status) {
                        SupportTicket::STATUS_RESOLVED => 'success',
                        SupportTicket::STATUS_CLOSED => 'default',
                        SupportTicket::STATUS_IN_PROGRESS => 'info',
                        default => 'warning',
                    },
                )),
            TD::make('created_at', __('Submitted'))
                ->render(fn (SupportTicket $ticket) => AdminTable::dateTime($ticket->created_at)),
            TD::make(__('Actions'))->align(TD::ALIGN_RIGHT)
                ->render(fn (SupportTicket $ticket) => Link::make(__('View'))
                    ->route('platform.data.support-tickets.edit', $ticket)
                    ->icon('bs.eye')),
        ];
    }
}
