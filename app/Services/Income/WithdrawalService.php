<?php

namespace App\Services\Income;

use App\Models\IncomeWalletTransaction;
use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Models\User;
use App\Models\Withdrawal;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WithdrawalService
{
    public const ADMIN_FEE_SOURCE = 'cash_out_admin_fee';

    public function __construct(
        protected LedgerWriter $ledger,
        protected CompanyReserveLedger $companyReserve,
        protected WalletBalanceService $wallets,
        protected AffiliateTeamRewardsService $teamRewards,
    ) {}

    /**
     * Rolling-window rate limit status for UI + enforcement.
     *
     * @return array{
     *     enabled: bool,
     *     max_per_window: int,
     *     window_hours: int,
     *     used_in_window: int,
     *     remaining: int,
     *     can_request: bool,
     *     next_available_at: string|null,
     *     slot_frees_at: list<string>
     * }
     */
    public function rateLimitStatus(User $user): array
    {
        $rules = RewardPlan::walletWithdrawalRateLimit();
        $max = $rules['max_per_window'];
        $hours = $rules['window_hours'];
        $enabled = $rules['enabled'];

        if (! $enabled) {
            return [
                'enabled' => false,
                'max_per_window' => $max,
                'window_hours' => $hours,
                'used_in_window' => 0,
                'remaining' => $max,
                'can_request' => true,
                'next_available_at' => null,
                'slot_frees_at' => [],
            ];
        }

        $windowStart = now()->subHours($hours);
        $recent = Withdrawal::query()
            ->where('user_id', $user->id)
            ->where('created_at', '>', $windowStart)
            ->orderBy('created_at')
            ->get(['id', 'created_at']);

        $used = $recent->count();
        $slotFreesAt = $recent
            ->map(static fn (Withdrawal $w) => $w->created_at?->copy()->addHours($hours)?->toIso8601String())
            ->filter()
            ->values()
            ->all();

        $canRequest = $used < $max;
        $nextAvailable = null;
        if (! $canRequest && $recent->isNotEmpty()) {
            $oldest = $recent->first();
            $nextAvailable = $oldest->created_at?->copy()->addHours($hours)?->toIso8601String();
        }

        return [
            'enabled' => true,
            'max_per_window' => $max,
            'window_hours' => $hours,
            'used_in_window' => $used,
            'remaining' => max(0, $max - $used),
            'can_request' => $canRequest,
            'next_available_at' => $nextAvailable,
            'slot_frees_at' => $slotFreesAt,
        ];
    }

    /**
     * Create a user income / USDT wallet withdrawal request.
     *
     * Server-side dual fee (do not trust client):
     *   Team Reward = 10% of gross → L1–L10
     *   Admin Fee   = $1 if gross < 100; else 1% → Admin/Treasury ledger
     * Net = gross − team − admin. Gross remains reserved until admin approval debit.
     *
     * Does NOT apply to fixed maturity / EMI / Engine Flexible stake exit.
     */
    public function request(User $user, string $grossAmountUsd, string $destinationAddress): Withdrawal
    {
        if (\App\Support\IncomeVaultFinancialAuthority::isAuthoritative()
            && ! config('income_vault.legacy_withdrawal_enabled', true)) {
            throw ValidationException::withMessages([
                'amount_usd' => __('Use on-chain RaceIncomeVault withdrawal when authoritative mode is enabled.'),
            ]);
        }

        \App\Support\BlockchainMode::assertReadOnlyRewards();

        if (! $user->canRequestWithdrawal()) {
            throw ValidationException::withMessages([
                'amount_usd' => __('Withdrawals are disabled for your account. Contact support.'),
            ]);
        }

        $rate = $this->rateLimitStatus($user);
        if ($rate['enabled'] && ! $rate['can_request']) {
            throw ValidationException::withMessages([
                'amount_usd' => __(
                    'Limit: :max withdrawals per :hours hours. Next available after :when.',
                    [
                        'max' => $rate['max_per_window'],
                        'hours' => $rate['window_hours'],
                        'when' => $rate['next_available_at']
                            ? \Illuminate\Support\Carbon::parse($rate['next_available_at'])->timezone(config('app.timezone'))->format('d M Y, h:i A')
                            : __('24 hours'),
                    ],
                ),
            ]);
        }

        $min = number_format((float) (RewardPlan::walletWithdrawalFeeRulesForUi()['min_amount_usd'] ?? 1), 2, '.', '');
        $gross = number_format((float) $grossAmountUsd, 2, '.', '');
        if (bccomp($gross, $min, 2) < 0) {
            throw ValidationException::withMessages([
                'amount_usd' => __('Minimum withdrawal is :min USDT.', ['min' => $min]),
            ]);
        }

        $storedAddress = trim((string) ($user->wallet_address ?? ''));
        $destination = $storedAddress !== ''
            ? $storedAddress
            : trim($destinationAddress);
        if ($destination === '' || strlen($destination) < 10) {
            throw ValidationException::withMessages([
                'destination_address' => __('Enter a valid BEP20 wallet address.'),
            ]);
        }

        $feeCalc = RewardPlan::calculateWalletWithdrawalFee($gross);
        $teamReward = $feeCalc['team_reward_usd'];
        $adminFee = $feeCalc['admin_fee_usd'];
        $net = $feeCalc['net_usd'];
        if (bccomp($net, '0', 2) <= 0) {
            throw ValidationException::withMessages([
                'amount_usd' => __('Amount too small after Team Reward and Admin Fee. Increase the withdrawal amount.'),
            ]);
        }

        return DB::transaction(function () use ($user, $gross, $teamReward, $adminFee, $net, $destination, $storedAddress) {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if (! $locked->canRequestWithdrawal()) {
                throw ValidationException::withMessages([
                    'amount_usd' => __('Withdrawals are disabled for your account. Contact support.'),
                ]);
            }

            $rate = $this->rateLimitStatus($locked);
            if ($rate['enabled'] && ! $rate['can_request']) {
                throw ValidationException::withMessages([
                    'amount_usd' => __(
                        'Limit: :max withdrawals per :hours hours. Next available after :when.',
                        [
                            'max' => $rate['max_per_window'],
                            'hours' => $rate['window_hours'],
                            'when' => $rate['next_available_at']
                                ? \Illuminate\Support\Carbon::parse($rate['next_available_at'])->timezone(config('app.timezone'))->format('d M Y, h:i A')
                                : __('24 hours'),
                        ],
                    ),
                ]);
            }

            $balance = $this->wallets->virtualIncomeBalance($locked);
            if (bccomp($balance, $gross, 2) < 0) {
                throw ValidationException::withMessages([
                    'amount_usd' => __('Insufficient Virtual Income Wallet balance.'),
                ]);
            }

            if ($storedAddress === '') {
                $locked->forceFill(['wallet_address' => $destination])->save();
            }

            $withdrawal = Withdrawal::query()->create([
                'user_id' => $locked->id,
                'amount_usd' => $gross,
                'fee_usd' => $teamReward,
                'team_reward_usd' => $teamReward,
                'admin_fee_usd' => $adminFee,
                'net_usd' => $net,
                'destination_address' => $destination,
                'status' => Withdrawal::STATUS_PENDING,
            ]);

            $this->creditCashOutAdminFee($withdrawal);
            $this->teamRewards->onWithdrawal($locked, $withdrawal);

            app(VirtualIncomeWalletService::class)->debit(
                $locked,
                \App\Models\IncomeWalletTransaction::TYPE_WITHDRAWAL,
                $gross,
                "withdrawal:{$withdrawal->id}",
                "withdrawal_request:{$withdrawal->id}",
                [
                    'withdrawal_id' => $withdrawal->id,
                    'team_reward_usd' => $teamReward,
                    'admin_fee_usd' => $adminFee,
                    'net_usd' => $net,
                    'note' => 'Gross reserved at request; ledger debit on admin approval',
                    'phase' => 'request_reserved',
                ],
            );

            return $withdrawal;
        });
    }

    /**
     * Admin approval: debit full gross from member; fees already accounted on request.
     */
    public function approve(Withdrawal $withdrawal): Withdrawal
    {
        return DB::transaction(function () use ($withdrawal) {
            $w = Withdrawal::query()->whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();
            if ($w->status === Withdrawal::STATUS_COMPLETED) {
                $this->ensureFeesDistributed($w);

                return $w;
            }
            if (! in_array($w->status, [Withdrawal::STATUS_PENDING, Withdrawal::STATUS_REJECTED], true)) {
                throw ValidationException::withMessages([
                    'status' => __('Only pending or rejected withdrawals can be marked completed.'),
                ]);
            }

            $user = User::query()->whereKey($w->user_id)->lockForUpdate()->firstOrFail();

            $already = LedgerEntry::query()
                ->where('user_id', $user->id)
                ->where('entry_type', LedgerEntry::TYPE_WALLET_WITHDRAWAL)
                ->where('reference_type', 'withdrawal')
                ->where('reference_id', $w->id)
                ->lockForUpdate()
                ->exists();
            if ($already) {
                $w->forceFill(['status' => Withdrawal::STATUS_COMPLETED])->save();
                $this->ensureFeesDistributed($w);

                return $w;
            }

            $gross = number_format((float) $w->amount_usd, 2, '.', '');
            $balance = $this->wallets->virtualIncomeBalance($user);
            if (bccomp($balance, $gross, 2) < 0) {
                throw ValidationException::withMessages([
                    'amount_usd' => __('Insufficient Virtual Income Wallet balance at approval time.'),
                ]);
            }

            $this->ensureFeesDistributed($w);

            $teamReward = $w->teamRewardUsd();
            $adminFee = $w->adminFeeUsd();

            $this->ledger->record(
                $user,
                LedgerEntry::TYPE_WALLET_WITHDRAWAL,
                '-'.$gross,
                'withdrawal',
                $w->id,
                [
                    'fee_usd' => $teamReward,
                    'team_reward_usd' => $teamReward,
                    'admin_fee_usd' => $adminFee,
                    'net_usd' => number_format((float) $w->net_usd, 2, '.', ''),
                    'destination_address' => (string) $w->destination_address,
                    'fee_destination' => 'community_team_rewards',
                    'admin_fee_destination' => 'admin_treasury',
                    'approved_by_admin' => true,
                ],
            );

            $w->forceFill(['status' => Withdrawal::STATUS_COMPLETED])->save();

            return $w;
        });
    }

    private function ensureFeesDistributed(Withdrawal $withdrawal): void
    {
        $this->creditCashOutAdminFee($withdrawal);

        $user = User::query()->find($withdrawal->user_id);
        if ($user) {
            $this->teamRewards->onWithdrawal($user, $withdrawal);
        }
    }

    /**
     * Record the SEPARATE cash-out Admin Fee ($1 / 1%) to company/treasury ledger.
     * Distinct from unqualified Team Reward remainder (also TYPE_WITHDRAWAL_ADMIN_FEE + different meta).
     */
    private function creditCashOutAdminFee(Withdrawal $withdrawal): void
    {
        $adminFee = $withdrawal->adminFeeUsd();
        if (bccomp($adminFee, '0', 2) <= 0) {
            return;
        }

        $exists = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE)
            ->where('reference_type', 'withdrawal')
            ->where('reference_id', $withdrawal->id)
            ->where('meta->source', self::ADMIN_FEE_SOURCE)
            ->exists();
        if ($exists) {
            return;
        }

        $gross = number_format((float) $withdrawal->amount_usd, 2, '.', '');

        $this->ledger->record(
            $this->companyReserve->user(),
            LedgerEntry::TYPE_WITHDRAWAL_ADMIN_FEE,
            $adminFee,
            'withdrawal',
            $withdrawal->id,
            [
                'source' => self::ADMIN_FEE_SOURCE,
                'from_user_id' => $withdrawal->user_id,
                'withdrawal_gross_usd' => $gross,
                'team_reward_usd' => $withdrawal->teamRewardUsd(),
                'admin_fee_usd' => $adminFee,
                'note' => 'Income withdrawal Admin Fee ($1 flat under $100, else 1%)',
                'admin_wallet_bep20' => SiteSetting::treasuryAddress(),
                'network' => SiteSetting::treasuryNetworkLabel(),
            ],
        );
    }

    public function reject(Withdrawal $withdrawal): Withdrawal
    {
        return DB::transaction(function () use ($withdrawal) {
            $w = Withdrawal::query()->whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();
            if ($w->status === Withdrawal::STATUS_COMPLETED) {
                throw ValidationException::withMessages([
                    'status' => __('Completed withdrawals cannot be rejected.'),
                ]);
            }
            if ($w->status === Withdrawal::STATUS_REJECTED) {
                return $w;
            }
            if ($w->status !== Withdrawal::STATUS_PENDING) {
                throw ValidationException::withMessages([
                    'status' => __('Only pending withdrawals can be rejected.'),
                ]);
            }

            $user = User::query()->whereKey($w->user_id)->lockForUpdate()->firstOrFail();
            $gross = number_format((float) $w->amount_usd, 2, '.', '');
            $refundKey = "withdrawal_reject_refund:{$w->id}";

            $existingRefund = IncomeWalletTransaction::query()
                ->where('user_id', $user->id)
                ->where('idempotency_key', $refundKey)
                ->exists();
            if (! $existingRefund) {
                app(VirtualIncomeWalletService::class)->credit(
                    $user,
                    IncomeWalletTransaction::TYPE_ADJUSTMENT,
                    $gross,
                    "withdrawal:{$w->id}",
                    $refundKey,
                    [
                        'withdrawal_id' => $w->id,
                        'reason' => 'withdrawal_rejected',
                        'note' => 'Virtual income restored after admin rejection',
                    ],
                );
            }

            $w->forceFill(['status' => Withdrawal::STATUS_REJECTED])->save();

            return $w;
        });
    }
}
