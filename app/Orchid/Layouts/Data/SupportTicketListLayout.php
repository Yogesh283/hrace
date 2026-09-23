<?php

declare(strict_types=1);

namespace App\Orchid\Layouts\Data;

use App\Models\SupportTicket;
use App\Orchid\Layouts\AdminVipTable;
use App\Orchid\Support\AdminTable;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\TD;

class SupportTicketListLayout extends AdminVipTable
{
    public $target = 'support_tickets';

    protected $title = 'Support tickets';

    public function columns(): array
    {
        return [
            TD::make('token', __('Token'))
                ->render(fn (SupportTicket $r) => '<span class="rx-admin-code">'.e($r->token).'</span>'),
            TD::make('user_id', __('Member'))->sort()
                ->render(fn (SupportTicket $r) => AdminTable::member(
                    $r->user?->name,
                    $r->user?->email,
                    $r->user?->member_number,
                )),
            TD::make('subject', __('Subject'))
                ->render(fn (SupportTicket $r) => e(\Illuminate\Support\Str::limit($r->subject, 60))),
            TD::make('status', __('Status'))->sort()
                ->render(fn (SupportTicket $r) => AdminTable::badge(
                    SupportTicket::statusLabels()[$r->status] ?? $r->status,
                    match ($r->status) {
                        SupportTicket::STATUS_RESOLVED => 'success',
                        SupportTicket::STATUS_CLOSED => 'default',
                        SupportTicket::STATUS_IN_PROGRESS => 'info',
                        default => 'warning',
                    },
                )),
            TD::make('created_at', __('Submitted'))->sort()
                ->render(fn (SupportTicket $r) => AdminTable::dateTime($r->created_at)),
            TD::make(__('Actions'))
                ->align(TD::ALIGN_RIGHT)
                ->render(fn (SupportTicket $r) => Link::make(__('View'))
                    ->route('platform.data.support-tickets.edit', $r)
                    ->icon('bs.eye')),
        ];
    }
}
