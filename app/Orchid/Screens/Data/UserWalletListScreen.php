<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\UserWallet;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\UserWalletListLayout;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Toast;

class UserWalletListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();
        $q = UserWallet::query()->with('user:id,name,email');
        $this->applyAdminSearch($q, $this->search, [], ['name', 'email', 'member_number']);

        return [
            'search' => $this->search,
            'user_wallets' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
        ];
    }

    public function name(): ?string
    {
        return 'User wallets';
    }

    public function description(): ?string
    {
        return 'One wallet row per user (unique user_id).';
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return array_merge($this->searchCommandBar('platform.data.user-wallets'), [
            Link::make(__('Add'))
                ->icon('bs.plus-circle')
                ->route('platform.data.user-wallets.create'),
        ]);
    }

    public function layout(): iterable
    {
        return [
            AdminListSearchLayout::class,
            UserWalletListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.user-wallets';
    }

    public function remove(Request $request): RedirectResponse
    {
        UserWallet::query()->whereKey($request->integer('id'))->delete();
        Toast::info(__('Removed'));

        return redirect()->route('platform.data.user-wallets');
    }
}
