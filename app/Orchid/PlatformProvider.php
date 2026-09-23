<?php

declare(strict_types=1);

namespace App\Orchid;

use Orchid\Platform\Dashboard;
use Orchid\Platform\ItemPermission;
use Orchid\Platform\OrchidServiceProvider;
use Orchid\Screen\Actions\Menu;

class PlatformProvider extends OrchidServiceProvider
{
    /**
     * Bootstrap the application services.
     *
     * @param Dashboard $dashboard
     *
     * @return void
     */
    public function boot(Dashboard $dashboard): void
    {
        parent::boot($dashboard);
    }

    /**
     * Register the application menu.
     *
     * @return Menu[]
     */
    public function menu(): array
    {
        return [
            Menu::make(__('Dashboard'))
                ->icon('bs.speedometer2')
                ->route(config('platform.index'))
                ->title(__('Navigation')),

            Menu::make(__('Team structure'))
                ->icon('bs.diagram-3')
                ->route('platform.data.team')
                ->permission('platform.data')
                ->title(__('Members & teams')),

            Menu::make(__('User Full Data'))
                ->icon('bs.person-lines-fill')
                ->route('platform.data.user-full-data')
                ->permission('platform.data'),

            Menu::make(__('Users'))
                ->icon('bs.people')
                ->route('platform.systems.users')
                ->permission('platform.systems.users')
                ->title(__('Access Controls')),

            Menu::make(__('Roles'))
                ->icon('bs.shield')
                ->route('platform.systems.roles')
                ->permission('platform.systems.roles')
                ->divider(),

            Menu::make(__('Treasury address'))
                ->icon('bs.box-arrow-in-down')
                ->route('platform.data.treasury')
                ->permission('platform.data')
                ->title(__('Application data')),

            Menu::make(__('Multisig funds'))
                ->icon('bs.safe2')
                ->route('platform.data.multisig-funds')
                ->permission('platform.data'),

            Menu::make(__('Admin deposit'))
                ->icon('bs.plus-circle')
                ->route('platform.data.admin-deposit')
                ->permission('platform.data'),

            Menu::make(__('Member withdrawals'))
                ->icon('bs.slash-circle')
                ->route('platform.data.member-withdrawals')
                ->permission('platform.data'),

            Menu::make(__('Income plan (read-only)'))
                ->icon('bs.percent')
                ->route('platform.data.income')
                ->permission('platform.data'),

            Menu::make(__('Income release (manual)'))
                ->icon('bs.play-circle')
                ->route('platform.data.income-jobs')
                ->permission('platform.data'),

            Menu::make(__('Investments'))
                ->icon('bs.cash-stack')
                ->route('platform.data.investments')
                ->permission('platform.data'),

            Menu::make(__('Ledger'))
                ->icon('bs.journal-text')
                ->route('platform.data.ledger-entries')
                ->permission('platform.data'),

            Menu::make(__('Milestones'))
                ->icon('bs.flag')
                ->route('platform.data.milestone-payouts')
                ->permission('platform.data'),

            Menu::make(__('User wallets'))
                ->icon('bs.wallet2')
                ->route('platform.data.user-wallets')
                ->permission('platform.data'),

            Menu::make(__('Race Coin swaps'))
                ->icon('bs.arrow-left-right')
                ->route('platform.data.race-coin-swaps')
                ->permission('platform.data'),

            Menu::make(__('Withdrawals'))
                ->icon('bs.cash-coin')
                ->route('platform.data.withdrawals')
                ->permission('platform.data'),

            Menu::make(__('Member popup'))
                ->icon('bs.chat-square-text')
                ->route('platform.data.member-popup')
                ->permission('platform.data'),

            Menu::make(__('Support & complaints'))
                ->icon('bs.headset')
                ->route('platform.data.support-tickets')
                ->permission('platform.data'),

            Menu::make(__('Users'))
                ->icon('bs.person-badge')
                ->route('platform.lending.users')
                ->permission(['lending.user.block', 'lending.user.unblock'])
                ->title(__('Lending')),
        ];
    }

    /**
     * Register permissions for the application.
     *
     * @return ItemPermission[]
     */
    public function permissions(): array
    {
        return [
            ItemPermission::group(__('System'))
                ->addPermission('platform.systems.roles', __('Roles'))
                ->addPermission('platform.systems.users', __('Users')),

            ItemPermission::group(__('Application data'))
                ->addPermission('platform.data', __('Treasury, income, investments, ledger, wallets')),

            ItemPermission::group(__('Lending'))
                ->addPermission('lending.user.block', __('Block Lending ID'))
                ->addPermission('lending.user.unblock', __('Unblock Lending ID')),
        ];
    }
}
