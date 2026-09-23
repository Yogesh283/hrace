<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\Withdrawal;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\WithdrawalListLayout;
use Orchid\Screen\Screen;

class WithdrawalListScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public function query(): iterable
    {
        return [
            'withdrawals' => Withdrawal::query()
                ->with('user:id,name,email,member_number,level')
                ->defaultSort('id', 'desc')
                ->paginate(30),
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

    public function layout(): iterable
    {
        return [
            WithdrawalListLayout::class,
        ];
    }
}
