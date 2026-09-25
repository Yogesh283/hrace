<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\MilestonePayout;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\MilestonePayoutListLayout;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Toast;

class MilestonePayoutListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();
        $q = MilestonePayout::query()->with('user:id,name,email,member_number');
        $this->applyAdminSearch($q, $this->search, ['milestone_code']);

        return [
            'search' => $this->search,
            'milestone_payouts' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
        ];
    }

    public function name(): ?string
    {
        return 'Milestone payouts';
    }

    public function description(): ?string
    {
        return 'Milestone flags per user.';
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return array_merge($this->searchCommandBar('platform.data.milestone-payouts'), [
            Link::make(__('Add'))
                ->icon('bs.plus-circle')
                ->route('platform.data.milestone-payouts.create'),
        ]);
    }

    public function layout(): iterable
    {
        return [
            AdminListSearchLayout::class,
            MilestonePayoutListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.milestone-payouts';
    }

    public function remove(Request $request): RedirectResponse
    {
        MilestonePayout::query()->whereKey($request->integer('id'))->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.milestone-payouts');
    }
}
