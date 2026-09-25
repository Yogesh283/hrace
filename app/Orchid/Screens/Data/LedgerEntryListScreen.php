<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\LedgerEntry;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\LedgerEntryListLayout;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Toast;

class LedgerEntryListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();
        $q = LedgerEntry::query()->with('user:id,name,email,member_number');
        $this->applyAdminSearch($q, $this->search, ['entry_type', 'reference_type']);

        return [
            'search' => $this->search,
            'ledger_entries' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
        ];
    }

    public function name(): ?string
    {
        return 'Ledger entries';
    }

    public function description(): ?string
    {
        return 'Balance and commission ledger lines.';
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return array_merge($this->searchCommandBar('platform.data.ledger-entries'), [
            Link::make(__('Add'))
                ->icon('bs.plus-circle')
                ->route('platform.data.ledger-entries.create'),
        ]);
    }

    public function layout(): iterable
    {
        return [
            AdminListSearchLayout::class,
            LedgerEntryListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.ledger-entries';
    }

    public function remove(Request $request): RedirectResponse
    {
        LedgerEntry::query()->whereKey($request->integer('id'))->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.ledger-entries');
    }
}
