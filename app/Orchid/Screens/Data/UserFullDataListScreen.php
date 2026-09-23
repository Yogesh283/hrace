<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\BlockchainParticipation;
use App\Models\User;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\UserFullDataSearchLayout;
use App\Orchid\Layouts\Data\UserFullDataSearchListLayout;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;

class UserFullDataListScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public string $search = '';

    public function query(): iterable
    {
        $this->search = trim((string) request()->query('search', ''));

        $users = User::query()
            ->with(['roles', 'referrer:id,name,email,member_number'])
            ->withCount([
                'referrals as direct_team_count',
                'investments as investments_count',
                'ledgerEntries as ledger_entries_count',
            ]);

        if ($this->search !== '') {
            $this->applySearch($users, $this->search);
        }

        return [
            'search' => $this->search,
            'users' => $users
                ->defaultSort('id', 'desc')
                ->paginate(25)
                ->withQueryString(),
        ];
    }

    public function name(): ?string
    {
        return __('User Full Data');
    }

    public function description(): ?string
    {
        return __('Read-only member search across profile, member code, referral, and wallet identifiers.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        return [
            Button::make(__('Search'))
                ->icon('bs.search')
                ->method('search'),

            Link::make(__('Clear'))
                ->icon('bs.x-circle')
                ->route('platform.data.user-full-data')
                ->canSee($this->search !== ''),
        ];
    }

    public function layout(): iterable
    {
        return [
            UserFullDataSearchLayout::class,
            UserFullDataSearchListLayout::class,
        ];
    }

    public function search(Request $request): RedirectResponse
    {
        $search = trim((string) $request->input('search', ''));

        return redirect()->route(
            'platform.data.user-full-data',
            $search === '' ? [] : ['search' => $search],
        );
    }

    private function applySearch(Builder $query, string $search): void
    {
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
        $digits = preg_replace('/\D+/', '', $search);
        $userColumns = array_flip(Schema::getColumnListing('users'));

        $query->where(function (Builder $q) use ($search, $like, $digits, $userColumns): void {
            if (ctype_digit($search)) {
                $q->orWhere('id', (int) $search);
            }

            if ($digits !== null && $digits !== '' && isset($userColumns['member_number'])) {
                $q->orWhere('member_number', (int) ltrim($digits, '0'));
            }

            foreach (['name', 'email', 'referral_code', 'joined_with_code', 'wallet_address'] as $column) {
                if (isset($userColumns[$column])) {
                    $q->orWhere($column, 'like', $like);
                }
            }

            if (class_exists(BlockchainParticipation::class) && Schema::hasTable('blockchain_participations')) {
                $q->orWhereIn('id', BlockchainParticipation::query()
                    ->select('user_id')
                    ->where('wallet_address', 'like', $like));
            }
        });
    }
}
