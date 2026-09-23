<?php

declare(strict_types=1);

namespace App\Orchid\Screens\Data;

use App\Models\BlockchainParticipation;
use App\Models\CommunityLeadershipDailyHold;
use App\Models\Investment;
use App\Models\LedgerEntry;
use App\Models\MilestonePayout;
use App\Models\RaceCoinSwap;
use App\Models\SupportTicket;
use App\Models\User;
use App\Models\UserWallet;
use App\Models\Withdrawal;
use App\Orchid\Concerns\RequiresPlatformDataPermission;
use App\Orchid\Layouts\Data\UserFullDataBlockchainParticipationsLayout;
use App\Orchid\Layouts\Data\UserFullDataCommunityLeadershipDailyHoldsLayout;
use App\Orchid\Layouts\Data\UserFullDataDepositEntriesLayout;
use App\Orchid\Layouts\Data\UserFullDataDirectReferralsLayout;
use App\Orchid\Layouts\Data\UserFullDataInvestmentsLayout;
use App\Orchid\Layouts\Data\UserFullDataLedgerEntriesLayout;
use App\Orchid\Layouts\Data\UserFullDataMilestonePayoutsLayout;
use App\Orchid\Layouts\Data\UserFullDataRaceCoinSwapsLayout;
use App\Orchid\Layouts\Data\UserFullDataSupportTicketsLayout;
use App\Orchid\Layouts\Data\UserFullDataWalletLayout;
use App\Orchid\Layouts\Data\UserFullDataWithdrawalsLayout;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Orchid\Screen\Action;
use Orchid\Screen\Actions\Link;
use Orchid\Screen\Fields\Label;
use Orchid\Screen\Screen;
use Orchid\Support\Facades\Layout;

class UserFullDataShowScreen extends Screen
{
    use RequiresPlatformDataPermission;

    public User $user;

    public ?int $wallet_id = null;

    public string $role_names = '';

    public string $referrer_summary = '';

    public string $activation_summary = '';

    public string $affiliate_placement_summary = '';

    public string $support_notice = '';

    public function query(User $user): iterable
    {
        $user->load([
            'roles',
            'referrer:id,name,email,member_number,referral_code',
            'userWallet',
        ]);

        $this->wallet_id = $user->userWallet?->id;
        $this->role_names = $user->roles->pluck('name')->filter()->implode(', ') ?: 'None';
        $this->referrer_summary = $this->memberSummary($user->referrer);
        $this->activation_summary = $user->id_activated_at
            ? 'Activated '.$user->id_activated_at->format('M j, Y H:i')
            : 'Not activated';
        $this->affiliate_placement_summary = $this->affiliatePlacementSummary($user);
        $this->support_notice = __('Related tables show latest 50 rows per section.');

        return [
            'user' => $user,
            'wallet_id' => $this->wallet_id,
            'role_names' => $this->role_names,
            'referrer_summary' => $this->referrer_summary,
            'activation_summary' => $this->activation_summary,
            'affiliate_placement_summary' => $this->affiliate_placement_summary,
            'support_notice' => $this->support_notice,
            'wallets' => $this->latestFor(UserWallet::class, 'user_wallets', $user->id),
            'investments' => $this->latestFor(Investment::class, 'investments', $user->id),
            'ledger_entries' => $this->latestFor(LedgerEntry::class, 'ledger_entries', $user->id),
            'deposit_entries' => $this->latestFor(LedgerEntry::class, 'ledger_entries', $user->id, function ($query): void {
                $query->where('entry_type', LedgerEntry::TYPE_WALLET_DEPOSIT);
            }),
            'withdrawals' => $this->latestFor(Withdrawal::class, 'withdrawals', $user->id),
            'support_tickets' => $this->latestFor(SupportTicket::class, 'support_tickets', $user->id),
            'race_coin_swaps' => $this->latestFor(RaceCoinSwap::class, 'race_coin_swaps', $user->id),
            'milestone_payouts' => $this->latestFor(MilestonePayout::class, 'milestone_payouts', $user->id),
            'direct_referrals' => $this->userChildren('referred_by', $user->id),
            'blockchain_participations' => $this->latestFor(BlockchainParticipation::class, 'blockchain_participations', $user->id),
            'community_leadership_daily_holds' => $this->latestFor(CommunityLeadershipDailyHold::class, 'community_leadership_daily_holds', $user->id),
        ];
    }

    public function name(): ?string
    {
        return __('User Full Data: :name', ['name' => $this->user->name]);
    }

    public function description(): ?string
    {
        return __('Read-only consolidated member data. Sensitive auth fields, raw permissions, raw meta, and blockchain payloads are intentionally omitted.');
    }

    /**
     * @return Action[]
     */
    public function commandBar(): iterable
    {
        $actions = [
            Link::make(__('Back to search'))
                ->icon('bs.arrow-left')
                ->route('platform.data.user-full-data'),
        ];

        if (optional(request()->user())->hasAccess('platform.systems.users') === true) {
            $actions[] = Link::make(__('Edit user'))
                ->icon('bs.pencil')
                ->route('platform.systems.users.edit', $this->user->id);
        }

        if ($this->wallet_id !== null) {
            $actions[] = Link::make(__('Open wallet'))
                ->icon('bs.wallet2')
                ->route('platform.data.user-wallets.edit', $this->wallet_id);
        }

        return $actions;
    }

    public function layout(): iterable
    {
        return [
            Layout::tabs([
                __('Profile') => [
                    Layout::rows([
                        Label::make('user.id')->title(__('User ID')),
                        Label::make('user.member_code')->title(__('Member code')),
                        Label::make('user.name')->title(__('Name')),
                        Label::make('user.email')->title(__('Email')),
                        Label::make('user.wallet_address')->title(__('Wallet address')),
                        Label::make('user.referral_code')->title(__('Referral code')),
                        Label::make('role_names')->title(__('Roles')),
                        Label::make('user.level')->title(__('Level')),
                        Label::make('user.is_blocked')->title(__('Blocked')),
                        Label::make('user.withdrawals_disabled')->title(__('Withdrawals disabled')),
                        Label::make('user.created_at')->title(__('Joined')),
                    ]),
                ],
                __('Activation') => [
                    Layout::rows([
                        Label::make('activation_summary')->title(__('Activation')),
                        Label::make('user.participation_activated_at')->title(__('Participation activated at')),
                        Label::make('user.compound_rewards_enabled')->title(__('Compounding enabled')),
                        Label::make('referrer_summary')->title(__('Referrer')),
                        Label::make('user.joined_with_code')->title(__('Joined with code')),
                        Label::make('affiliate_placement_summary')->title(__('Affiliate placement milestones')),
                    ]),
                ],
                __('Wallet & Ledger') => [
                    Layout::rows([
                        Label::make('support_notice')->title(__('Scope')),
                    ]),
                    UserFullDataWalletLayout::class,
                    UserFullDataInvestmentsLayout::class,
                    UserFullDataDepositEntriesLayout::class,
                    UserFullDataLedgerEntriesLayout::class,
                    UserFullDataWithdrawalsLayout::class,
                    UserFullDataRaceCoinSwapsLayout::class,
                ],
                __('Rewards & Support') => [
                    UserFullDataMilestonePayoutsLayout::class,
                    UserFullDataCommunityLeadershipDailyHoldsLayout::class,
                    UserFullDataSupportTicketsLayout::class,
                ],
                __('Network') => [
                    UserFullDataDirectReferralsLayout::class,
                ],
                __('Blockchain') => [
                    UserFullDataBlockchainParticipationsLayout::class,
                ],
            ]),
        ];
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @return Collection<int, Model>
     */
    private function latestFor(string $modelClass, string $table, int $userId, ?callable $scope = null): Collection
    {
        if (! class_exists($modelClass) || ! Schema::hasTable($table)) {
            return collect();
        }

        $query = $modelClass::query()->where('user_id', $userId);

        if ($scope !== null) {
            $scope($query);
        }

        return $query
            ->latest('id')
            ->limit(50)
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    private function userChildren(string $column, int $userId): Collection
    {
        if (! Schema::hasColumn('users', $column)) {
            return collect();
        }

        return User::query()
            ->select([
                'id',
                'member_number',
                'name',
                'email',
                'referral_code',
                'wallet_address',
                'level',
                'is_blocked',
                'id_activated_at',
                'created_at',
            ])
            ->where($column, $userId)
            ->latest('id')
            ->limit(50)
            ->get();
    }

    private function memberSummary(?User $user): string
    {
        if ($user === null) {
            return 'None';
        }

        return trim(sprintf(
            '#%d %s %s <%s>',
            $user->id,
            $user->member_code,
            $user->name,
            $user->email,
        ));
    }

    private function affiliatePlacementSummary(User $user): string
    {
        $parts = [
            'L1: '.($user->placement_l1_done_at?->format('M j, Y H:i') ?? 'Pending'),
            'L2: '.($user->placement_l2_done_at?->format('M j, Y H:i') ?? 'Pending'),
        ];

        return implode(' | ', $parts);
    }
}
