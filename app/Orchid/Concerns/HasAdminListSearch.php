<?php

declare(strict_types=1);

namespace App\Orchid\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Orchid\Screen\Actions\Button;
use Orchid\Screen\Actions\Link;

/**
 * Query-string search + command-bar Search/Clear for Orchid list screens.
 */
trait HasAdminListSearch
{
    public string $search = '';

    protected function loadSearchFromRequest(): string
    {
        $this->search = trim((string) request()->query('search', ''));

        return $this->search;
    }

    /**
     * @return list<\Orchid\Screen\Action>
     */
    protected function searchCommandBar(string $routeName): array
    {
        return [
            Button::make(__('Search'))
                ->icon('bs.search')
                ->method('search'),
            Link::make(__('Clear'))
                ->icon('bs.x-circle')
                ->route($routeName)
                ->canSee($this->search !== ''),
        ];
    }

    public function search(Request $request): RedirectResponse
    {
        $search = trim((string) $request->input('search', ''));
        $route = method_exists($this, 'searchRedirectRoute')
            ? $this->searchRedirectRoute()
            : (string) request()->route()?->getName();

        return redirect()->route($route, array_filter([
            'search' => $search !== '' ? $search : null,
        ]));
    }

    /**
     * @param  list<string>  $columns
     * @param  list<string>  $userColumns
     */
    protected function applyAdminSearch(
        Builder $query,
        string $search,
        array $columns = [],
        array $userColumns = ['name', 'email', 'member_number'],
        string $userRelation = 'user',
    ): void {
        if ($search === '') {
            return;
        }

        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
        $query->where(function (Builder $q) use ($like, $search, $columns, $userColumns, $userRelation): void {
            foreach ($columns as $col) {
                $q->orWhere($col, 'like', $like);
            }
            if (ctype_digit($search)) {
                $q->orWhere($q->getModel()->getQualifiedKeyName(), (int) $search)
                    ->orWhere('user_id', (int) $search);
            }
            if ($userRelation !== '' && $userColumns !== []) {
                $q->orWhereHas($userRelation, function (Builder $uq) use ($like, $userColumns): void {
                    $uq->where(function (Builder $inner) use ($like, $userColumns): void {
                        foreach ($userColumns as $i => $col) {
                            if ($i === 0) {
                                $inner->where($col, 'like', $like);
                            } else {
                                $inner->orWhere($col, 'like', $like);
                            }
                        }
                    });
                });
            }
        });
    }
}
