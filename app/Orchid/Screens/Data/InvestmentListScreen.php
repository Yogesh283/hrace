<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\Investment;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\InvestmentListLayout;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Toast;

class InvestmentListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();
        $q = Investment::query()->with('user:id,name,email,level,member_number');
        $this->applyAdminSearch($q, $this->search, ['status']);

        return [
            'search' => $this->search,
            'investments' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
        ];
    }

    public function name(): ?string
    {
        return 'Investments';
    }

    public function description(): ?string
    {
        return 'All investment rows; open a row to edit.';
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return array_merge($this->searchCommandBar('platform.data.investments'), [
            Link::make(__('Add'))
                ->icon('bs.plus-circle')
                ->route('platform.data.investments.create'),
        ]);
    }

    public function layout(): iterable
    {
        return [
            AdminListSearchLayout::class,
            InvestmentListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.investments';
    }

    public function remove(Request $request): RedirectResponse
    {
        Investment::query()->whereKey($request->integer('id'))->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.investments');
    }
}
