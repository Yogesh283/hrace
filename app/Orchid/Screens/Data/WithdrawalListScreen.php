<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\Withdrawal;
use App\Orchid\Concerns\HasAdminListSearch;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\AdminListSearchLayout;
use App\Orchid\Layouts\Data\WithdrawalListLayout;
use Orchid\Screen\Action;
use Orchid\Screen\Screen;

class WithdrawalListScreen extends Screen
{
    use HasAdminListSearch;
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        $this->loadSearchFromRequest();
        $q = Withdrawal::query()->with('user:id,name,email,member_number,level');
        $this->applyAdminSearch($q, $this->search, ['status', 'destination_address']);

        return [
            'search' => $this->search,
            'withdrawals' => $q->defaultSort('id', 'desc')->paginate(30)->withQueryString(),
        ];
    }

    public function name(): ?string
    {
        return __('Withdrawals');
    }

    public function description(): ?string
    {
        return __('All withdrawal requests and payouts.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return $this->searchCommandBar('platform.data.withdrawals');
    }

    public function layout(): iterable
    {
        return [
            AdminListSearchLayout::class,
            WithdrawalListLayout::class,
        ];
    }

    protected function searchRedirectRoute(): string
    {
        return 'platform.data.withdrawals';
    }
}
