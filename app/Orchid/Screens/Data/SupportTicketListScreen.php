<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\SupportTicket;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\SupportTicketListLayout;
use Orchid\Screen\Screen;

class SupportTicketListScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        return [
            'support_tickets' => SupportTicket::query()
                ->with('user:id,name,email,member_number')
                ->defaultSort('id', 'desc')
                ->paginate(30),
        ];
    }

    public function name(): ?string
    {
        return __('Support tickets');
    }

    public function description(): ?string
    {
        return __('Member complaints and support requests.');
    }

    public function layout(): iterable
    {
        return [
            SupportTicketListLayout::class,
        ];
    }
}
