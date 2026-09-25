<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\BlockchainEngineStake;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\BlockchainStakeListLayout;
use App\Orchid\Layouts\Data\BlockchainStakeSearchLayout;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

/**
 * Indexed Engine stakes (blockchain ingest) — who staked how much, with search.
 */
class BlockchainStakesListScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public string $search = '';

    public function query(): iterable
    {
        $this->search = trim((string) request()->query('search', ''));

        if (! Schema::hasTable((new BlockchainEngineStake)->getTable())) {
            return [
                'search' => $this->search,
                'stakes' => BlockchainEngineStake::query()->whereRaw('1=0')->paginate(25),
                'summary' => [
                    'users' => 0,
                    'rows' => 0,
                    'usdt' => '0',
                    'race' => '0',
                ],
            ];
        }

        $base = BlockchainEngineStake::query()->with(['user:id,name,email,member_number']);

        if ($this->search !== '') {
            $this->applySearch($base, $this->search);
        }

        $summaryQ = clone $base;
        $active = (clone $summaryQ)->where('withdrawn', false);

        return [
            'search' => $this->search,
            'stakes' => $base->orderByDesc('id')->paginate(30)->withQueryString(),
            'summary' => [
                'users' => (int) (clone $active)->distinct('wallet_address')->count('wallet_address'),
                'rows' => (int) (clone $active)->count(),
                'usdt' => (string) ((clone $active)->sum('principal_usdt') ?: '0'),
                'race' => (string) ((clone $active)->sum('staked_race') ?: '0'),
            ],
        ];
    }

    public function name(): ?string
    {
        return __('On-chain stakes');
    }

    public function description(): ?string
    {
        return __('Users and amounts indexed from blockchain Engine stakes. Search by wallet, member, or tx.');
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
                ->route('platform.data.blockchain-stakes')
                ->canSee($this->search !== ''),
            Link::make(__('Blockchain overview'))
                ->icon('bs.graph-up')
                ->route('platform.data.blockchain-overview'),
        ];
    }

    public function layout(): iterable
    {
        return [
            BlockchainStakeSearchLayout::class,
            Layout::view('orchid.blockchain-stakes-summary'),
            BlockchainStakeListLayout::class,
        ];
    }

    public function search(Request $request): RedirectResponse
    {
        $search = trim((string) $request->input('search', ''));

        return redirect()->route('platform.data.blockchain-stakes', array_filter([
            'search' => $search !== '' ? $search : null,
        ]));
    }

    private function applySearch(Builder $query, string $search): void
    {
        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
        $query->where(function (Builder $q) use ($like, $search): void {
            $q->where('wallet_address', 'like', $like)
                ->orWhere('tx_hash', 'like', $like)
                ->orWhere('contract_address', 'like', $like)
                ->orWhere('source_type', 'like', $like)
                ->orWhere('status', 'like', $like);
            if (ctype_digit($search)) {
                $q->orWhere('id', (int) $search)
                    ->orWhere('user_id', (int) $search)
                    ->orWhere('stake_index', (int) $search)
                    ->orWhere('ico_purchase_id', (int) $search);
            }
            $q->orWhereHas('user', function (Builder $uq) use ($like): void {
                $uq->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('member_number', 'like', $like);
            });
        });
    }
}
