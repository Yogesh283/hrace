<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\SupportTicket;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\SupportTicketListLayout;
use Orchid\Screen\Action;
use Orchid\Screen\Screen;

class SupportTicketListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();
        $q = SupportTicket::query()->with('user:id,name,email,member_number');
        $this->applyAdminSearch($q, $this->search, ['subject', 'status', 'token', 'message']);

        return [
            'search' => $this->search,
            'support_tickets' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
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

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return $this->searchCommandBar('platform.data.support-tickets');
    }

    public function layout(): iterable
    {
        return [
            AdminListSearchLayout::class,
            SupportTicketListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.support-tickets';
    }
}
