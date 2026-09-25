<?php

declare(strict_types=1);

use App\Orchid\Screens\Lending\LendingUserListScreen;
use App\Orchid\Screens\PlatformScreen;
use App\Orchid\Screens\Role\RoleEditScreen;
use App\Orchid\Screens\Role\RoleListScreen;
use App\Orchid\Screens\Data\InvestmentEditScreen;
use App\Orchid\Screens\Data\InvestmentListScreen;
use App\Orchid\Screens\Data\LedgerEntryEditScreen;
use App\Orchid\Screens\Data\LedgerEntryListScreen;
use App\Orchid\Screens\Data\MilestonePayoutEditScreen;
use App\Orchid\Screens\Data\MilestonePayoutListScreen;
use App\Orchid\Screens\Data\IncomeSettingsScreen;
use App\Orchid\Screens\Data\IncomeJobsScreen;
use App\Orchid\Screens\Data\TeamStructureListScreen;
use App\Orchid\Screens\Data\TreasurySettingsScreen;
use App\Orchid\Screens\Data\IcoContractSettingsScreen;
use App\Orchid\Screens\Data\BlockchainOverviewScreen;
use App\Orchid\Screens\Data\BlockchainStakesListScreen;
use App\Orchid\Screens\Data\ContractWatchScreen;
use App\Orchid\Screens\Data\MultisigFundsScreen;
use App\Orchid\Screens\Data\MemberPopupSettingsScreen;
use App\Orchid\Screens\Data\SupportTicketEditScreen;
use App\Orchid\Screens\Data\SupportTicketListScreen;
use App\Orchid\Screens\Data\WithdrawalEditScreen;
use App\Orchid\Screens\Data\WithdrawalListScreen;
use App\Orchid\Screens\Data\AdminDepositScreen;
use App\Orchid\Screens\Data\AdminMemberWithdrawalScreen;
use App\Orchid\Screens\Data\RaceCoinSwapListScreen;
use App\Orchid\Screens\Data\UserWalletEditScreen;
use App\Orchid\Screens\Data\UserWalletListScreen;
use App\Orchid\Screens\Data\UserFullDataListScreen;
use App\Orchid\Screens\Data\UserFullDataShowScreen;
use App\Orchid\Screens\User\UserEditScreen;
use App\Orchid\Screens\User\UserListScreen;
use App\Orchid\Screens\User\UserProfileScreen;
use Illuminate\Support\Facades\Route;
use Tabuna\Breadcrumbs\Trail;

/*
|--------------------------------------------------------------------------
| Dashboard Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the need "dashboard" middleware group. Now create something great!
|
*/

// Main
Route::screen('/main', PlatformScreen::class)
    ->name('platform.main');

// Platform > Profile
Route::screen('profile', UserProfileScreen::class)
    ->name('platform.profile')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.index')
        ->push(__('Profile'), route('platform.profile')));

// Platform > System > Users > User
Route::screen('users/{user}/edit', UserEditScreen::class)
    ->name('platform.systems.users.edit')
    ->breadcrumbs(fn (Trail $trail, $user) => $trail
        ->parent('platform.systems.users')
        ->push($user->name, route('platform.systems.users.edit', $user)));

// Platform > System > Users > Create
Route::screen('users/create', UserEditScreen::class)
    ->name('platform.systems.users.create')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.systems.users')
        ->push(__('Create'), route('platform.systems.users.create')));

// Platform > System > Users
Route::screen('users', UserListScreen::class)
    ->name('platform.systems.users')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.index')
        ->push(__('Users'), route('platform.systems.users')));

// Platform > System > Roles > Role
Route::screen('roles/{role}/edit', RoleEditScreen::class)
    ->name('platform.systems.roles.edit')
    ->breadcrumbs(fn (Trail $trail, $role) => $trail
        ->parent('platform.systems.roles')
        ->push($role->name, route('platform.systems.roles.edit', $role)));

// Platform > System > Roles > Create
Route::screen('roles/create', RoleEditScreen::class)
    ->name('platform.systems.roles.create')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.systems.roles')
        ->push(__('Create'), route('platform.systems.roles.create')));

// Platform > System > Roles
Route::screen('roles', RoleListScreen::class)
    ->name('platform.systems.roles')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.index')
        ->push(__('Roles'), route('platform.systems.roles')));

// Application data (tables) — register create/edit before list so "create" is not captured as {method?}.
Route::screen('data/treasury', TreasurySettingsScreen::class)->name('platform.data.treasury');
Route::screen('data/blockchain', BlockchainOverviewScreen::class)
    ->name('platform.data.blockchain-overview')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.index')
        ->push(__('All contracts & reports'), route('platform.data.blockchain-overview')));
Route::screen('data/blockchain-stakes', BlockchainStakesListScreen::class)
    ->name('platform.data.blockchain-stakes')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.data.blockchain-overview')
        ->push(__('On-chain stakes'), route('platform.data.blockchain-stakes')));
Route::screen('data/ico-contract', IcoContractSettingsScreen::class)->name('platform.data.ico-contract');
Route::screen('data/contracts-watch', ContractWatchScreen::class)->name('platform.data.contracts-watch');
Route::screen('data/multisig-funds', MultisigFundsScreen::class)->name('platform.data.multisig-funds');

Route::screen('data/admin-deposit', AdminDepositScreen::class)->name('platform.data.admin-deposit');

Route::screen('data/member-withdrawals', AdminMemberWithdrawalScreen::class)->name('platform.data.member-withdrawals');

Route::screen('data/team', TeamStructureListScreen::class)->name('platform.data.team');

Route::screen('data/user-full-data/{user}', UserFullDataShowScreen::class)->name('platform.data.user-full-data.show');
Route::screen('data/user-full-data', UserFullDataListScreen::class)->name('platform.data.user-full-data');

Route::screen('data/income', IncomeSettingsScreen::class)->name('platform.data.income');
Route::screen('data/income-jobs', IncomeJobsScreen::class)->name('platform.data.income-jobs');

Route::screen('data/member-popup', MemberPopupSettingsScreen::class)->name('platform.data.member-popup');

Route::screen('data/investments/create', InvestmentEditScreen::class)->name('platform.data.investments.create');
Route::screen('data/investments/{investment}/edit', InvestmentEditScreen::class)->name('platform.data.investments.edit');
Route::screen('data/investments', InvestmentListScreen::class)->name('platform.data.investments');

Route::screen('data/ledger-entries/create', LedgerEntryEditScreen::class)->name('platform.data.ledger-entries.create');
Route::screen('data/ledger-entries/{ledger_entry}/edit', LedgerEntryEditScreen::class)->name('platform.data.ledger-entries.edit');
Route::screen('data/ledger-entries', LedgerEntryListScreen::class)->name('platform.data.ledger-entries');

Route::screen('data/milestone-payouts/create', MilestonePayoutEditScreen::class)->name('platform.data.milestone-payouts.create');
Route::screen('data/milestone-payouts/{milestone_payout}/edit', MilestonePayoutEditScreen::class)->name('platform.data.milestone-payouts.edit');
Route::screen('data/milestone-payouts', MilestonePayoutListScreen::class)->name('platform.data.milestone-payouts');

Route::screen('data/user-wallets/create', UserWalletEditScreen::class)->name('platform.data.user-wallets.create');
Route::screen('data/user-wallets/{user_wallet}/edit', UserWalletEditScreen::class)->name('platform.data.user-wallets.edit');
Route::screen('data/user-wallets', UserWalletListScreen::class)->name('platform.data.user-wallets');

Route::screen('data/race-coin-swaps', RaceCoinSwapListScreen::class)->name('platform.data.race-coin-swaps');

Route::screen('data/withdrawals', WithdrawalListScreen::class)->name('platform.data.withdrawals');
Route::screen('data/withdrawals/{withdrawal}/edit', WithdrawalEditScreen::class)->name('platform.data.withdrawals.edit');

Route::screen('data/support-tickets/{support_ticket}/edit', SupportTicketEditScreen::class)
    ->name('platform.data.support-tickets.edit');
Route::screen('data/support-tickets', SupportTicketListScreen::class)->name('platform.data.support-tickets');

Route::screen('lending/users', LendingUserListScreen::class)
    ->name('platform.lending.users')
    ->breadcrumbs(fn (Trail $trail) => $trail
        ->parent('platform.index')
        ->push(__('Lending users'), route('platform.lending.users')));
