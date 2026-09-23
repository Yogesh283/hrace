<?php

namespace App\Services\Income;

use App\Models\IcoRaceTransfer;
use App\Models\IcoStake;
use App\Models\RaceCoinSwap;
use App\Models\User;
use App\Models\UserWallet;
use App\Services\Blockchain\BscUsdtTransferVerifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IcoStakeService
{
    public function __construct(
        protected BscUsdtTransferVerifier $usdtVerifier,
        protected RaceCoinService $raceCoins,
    ) {}

    /**
     * @return list<array{days:int,label:string,daily_reward_percent:float}>
     */
    public function durationTiers(): array
    {
        return array_values(config('ico.duration_tiers', []));
    }

    public function findDurationTier(int $days): ?array
    {
        foreach ($this->durationTiers() as $tier) {
            if ((int) ($tier['days'] ?? 0) === $days) {
                return $tier;
            }
        }

        return null;
    }

    public function currentPhaseId(): int
    {
        return (int) config('ico.current_phase_id', 1);
    }

    public function phasePriceUsd(?int $phaseId = null): string
    {
        $id = $phaseId ?? $this->currentPhaseId();
        $price = (float) (config("ico.phases.{$id}.price_usd") ?? 0.25);

        return number_format($price, 8, '.', '');
    }

    /**
     * Record an ICO buy + lock stake at the purchase price.
     *
     * @param  array{phase_id?:int,usdt_paid:string|float,race_amount?:string|float,duration_days:int,tx_hash?:string|null,purchased_at?:\DateTimeInterface|null}  $data
     */
    public function openStake(User $user, array $data): IcoStake
    {
        $days = (int) ($data['duration_days'] ?? 0);
        $tier = $this->findDurationTier($days);
        if ($tier === null) {
            throw ValidationException::withMessages([
                'duration_days' => __('Select a valid ICO lock duration.'),
            ]);
        }

        $phaseId = (int) ($data['phase_id'] ?? $this->currentPhaseId());
        $price = $this->phasePriceUsd($phaseId);
        $usdtPaid = number_format((float) $data['usdt_paid'], 2, '.', '');

        if (bccomp($usdtPaid, '0', 2) <= 0) {
            throw ValidationException::withMessages([
                'usdt_paid' => __('USDT amount must be greater than zero.'),
            ]);
        }

        $raceAmount = isset($data['race_amount'])
            ? number_format((float) $data['race_amount'], 8, '.', '')
            : number_format((float) $usdtPaid / (float) $price, 8, '.', '');

        $purchasedAt = $data['purchased_at'] ?? now();
        $unlockAt = (clone \Illuminate\Support\Carbon::parse($purchasedAt))->addDays($days);

        $txHash = isset($data['tx_hash']) ? strtolower(trim((string) $data['tx_hash'])) : null;
        if ($txHash) {
            $existing = IcoStake::query()->where('tx_hash', $txHash)->first();
            if ($existing) {
                return $existing;
            }
        }

        return IcoStake::query()->create([
            'user_id' => $user->id,
            'phase_id' => $phaseId,
            'purchase_price_usd' => $price,
            'usdt_paid' => $usdtPaid,
            'race_amount' => $raceAmount,
            'duration_days' => $days,
            'daily_reward_percent' => number_format((float) $tier['daily_reward_percent'], 4, '.', ''),
            'status' => IcoStake::STATUS_ACTIVE,
            'tx_hash' => $txHash,
            'purchased_at' => $purchasedAt,
            'unlock_at' => $unlockAt,
            'meta' => [
                'tier_label' => $tier['label'] ?? "{$days} Days",
            ],
        ]);
    }

    /**
     * Daily claim → credit virtual Race Coin (not wallet).
     */
    public function claimDaily(User $user, IcoStake $stake): array
    {
        if ($stake->user_id !== $user->id) {
            throw ValidationException::withMessages(['stake' => __('Stake not found.')]);
        }
        if ($stake->status !== IcoStake::STATUS_ACTIVE) {
            throw ValidationException::withMessages(['stake' => __('This stake is not active.')]);
        }

        $intervalHours = max(1, (int) config('ico.claim.interval_hours', 24));
        $anchor = $stake->last_claim_at ?? $stake->purchased_at ?? $stake->created_at;
        if ($anchor && $anchor->copy()->addHours($intervalHours)->isFuture()) {
            throw ValidationException::withMessages([
                'stake' => __('Next claim available after :hours hours from last claim.', [
                    'hours' => $intervalHours,
                ]),
            ]);
        }

        $dailyPercent = (string) $stake->daily_reward_percent;
        $principal = (string) $stake->race_amount;
        $reward = bcmul($principal, bcdiv($dailyPercent, '100', 8), 8);
        if (bccomp($reward, '0', 8) <= 0) {
            throw ValidationException::withMessages(['stake' => __('Nothing to claim.')]);
        }

        return DB::transaction(function () use ($user, $stake, $reward) {
            $locked = IcoStake::query()->whereKey($stake->id)->lockForUpdate()->firstOrFail();
            $wallet = UserWallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            if (! $wallet) {
                $wallet = UserWallet::query()->create([
                    'user_id' => $user->id,
                    'balance_usd' => 0,
                    'race_coin_balance' => 0,
                ]);
                $wallet = UserWallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();
            }

            $newBalance = bcadd((string) $wallet->race_coin_balance, $reward, 4);
            $wallet->forceFill(['race_coin_balance' => $newBalance])->save();

            $locked->forceFill([
                'last_claim_at' => now(),
                'total_claimed_race_coin' => bcadd((string) $locked->total_claimed_race_coin, $reward, 8),
                'claim_count' => ((int) $locked->claim_count) + 1,
            ])->save();

            RaceCoinSwap::query()->create([
                'user_id' => $user->id,
                'swap_type' => RaceCoinSwap::TYPE_ICO_CLAIM_CREDIT,
                'usdt_amount' => number_format((float) $reward * (float) $locked->purchase_price_usd, 2, '.', ''),
                'coins_amount' => number_format((float) $reward, 4, '.', ''),
                'balance_after_coins' => $newBalance,
                'tx_hash' => null,
                'meta' => [
                    'source' => 'ico_daily_claim',
                    'ico_stake_id' => $locked->id,
                    'purchase_price_usd' => (string) $locked->purchase_price_usd,
                    'daily_reward_percent' => (string) $locked->daily_reward_percent,
                ],
            ]);

            return [
                'claimed_race_coin' => number_format((float) $reward, 4, '.', ''),
                'race_coin_balance' => $newBalance,
                'purchase_price_usd' => (string) $locked->purchase_price_usd,
                'stake' => $locked->fresh(),
            ];
        });
    }

    /**
     * Transfer virtual Race Coin to connected wallet after $1 USDT admin fee is paid on-chain.
     */
    public function requestWalletTransfer(User $user, float $coinsAmount, string $feeTxHash): IcoRaceTransfer
    {
        $walletAddress = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($walletAddress === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $walletAddress)) {
            throw ValidationException::withMessages([
                'wallet' => __('Connect your crypto wallet first.'),
            ]);
        }

        $minCoins = (float) config('ico.wallet_transfer.min_coins', 1);
        $feeUsdt = (float) config('ico.wallet_transfer.admin_fee_usdt', 1);
        $coins = number_format($coinsAmount, 4, '.', '');

        if (bccomp($coins, number_format($minCoins, 4, '.', ''), 4) < 0) {
            throw ValidationException::withMessages([
                'coins' => __('Minimum transfer is :min Race Coin.', ['min' => $minCoins]),
            ]);
        }

        $feeTxHash = strtolower(trim($feeTxHash));
        if (! preg_match('/^0x[a-f0-9]{64}$/', $feeTxHash)) {
            throw ValidationException::withMessages([
                'fee_tx_hash' => __('Invalid USDT fee transaction hash.'),
            ]);
        }

        if (IcoRaceTransfer::query()->where('fee_tx_hash', $feeTxHash)->exists()) {
            throw ValidationException::withMessages([
                'fee_tx_hash' => __('This fee transaction was already used.'),
            ]);
        }

        $verified = $this->usdtVerifier->verify($feeTxHash, $feeUsdt, $walletAddress, 'ico_transfer_fee');
        if (! ($verified['ok'] ?? false)) {
            throw ValidationException::withMessages([
                'fee_tx_hash' => $verified['reason'] ?? __('Could not verify $1 USDT admin fee.'),
            ]);
        }

        $paid = (float) ($verified['amount_usd'] ?? 0);
        if ($paid + 0.0001 < $feeUsdt) {
            throw ValidationException::withMessages([
                'fee_tx_hash' => __('Admin fee must be at least $:fee USDT.', ['fee' => number_format($feeUsdt, 2)]),
            ]);
        }

        return DB::transaction(function () use ($user, $coins, $feeUsdt, $feeTxHash, $walletAddress, $verified) {
            $wallet = UserWallet::query()
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();
            if (! $wallet) {
                $wallet = UserWallet::query()->create([
                    'user_id' => $user->id,
                    'balance_usd' => 0,
                    'race_coin_balance' => 0,
                ]);
                $wallet = UserWallet::query()->whereKey($wallet->id)->lockForUpdate()->firstOrFail();
            }

            $balance = number_format((float) $wallet->race_coin_balance, 4, '.', '');
            if (bccomp($balance, $coins, 4) < 0) {
                throw ValidationException::withMessages([
                    'coins' => __('Insufficient Race Coin balance.'),
                ]);
            }

            $newBalance = bcsub($balance, $coins, 4);
            $wallet->forceFill(['race_coin_balance' => $newBalance])->save();

            RaceCoinSwap::query()->create([
                'user_id' => $user->id,
                'swap_type' => RaceCoinSwap::TYPE_ICO_TRANSFER_DEBIT,
                'usdt_amount' => number_format($feeUsdt, 2, '.', ''),
                'coins_amount' => '-'.$coins,
                'balance_after_coins' => $newBalance,
                'tx_hash' => $feeTxHash,
                'meta' => [
                    'source' => 'ico_wallet_transfer',
                    'admin_fee_usdt' => $feeUsdt,
                    'wallet_address' => $walletAddress,
                ],
            ]);

            return IcoRaceTransfer::query()->create([
                'user_id' => $user->id,
                'coins_amount' => $coins,
                'admin_fee_usdt' => number_format($feeUsdt, 2, '.', ''),
                'fee_tx_hash' => $feeTxHash,
                'wallet_address' => $walletAddress,
                'status' => IcoRaceTransfer::STATUS_PENDING,
                'meta' => [
                    'fee_verified_usd' => $verified['amount_usd'] ?? $feeUsdt,
                ],
            ]);
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function payloadForUser(User $user): array
    {
        $stakes = IcoStake::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->get()
            ->map(fn (IcoStake $s) => $this->serializeStake($s))
            ->values()
            ->all();

        $transfers = IcoRaceTransfer::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(fn (IcoRaceTransfer $t) => [
                'id' => $t->id,
                'coins_amount' => number_format((float) $t->coins_amount, 4, '.', ''),
                'admin_fee_usdt' => number_format((float) $t->admin_fee_usdt, 2, '.', ''),
                'fee_tx_hash' => $t->fee_tx_hash,
                'wallet_address' => $t->wallet_address,
                'status' => $t->status,
                'payout_tx_hash' => $t->payout_tx_hash,
                'created_at' => $t->created_at?->toIso8601String(),
                'completed_at' => $t->completed_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        return [
            'phases' => config('ico.phases', []),
            'current_phase_id' => $this->currentPhaseId(),
            'current_phase_price_usd' => $this->phasePriceUsd(),
            'duration_tiers' => $this->durationTiers(),
            'wallet_transfer' => config('ico.wallet_transfer', []),
            'admin_fee_usdt' => number_format((float) config('ico.wallet_transfer.admin_fee_usdt', 1), 2, '.', ''),
            'treasury_address' => \App\Models\SiteSetting::treasuryAddress(),
            'race_coin_balance' => $this->raceCoins->currentBalance($user),
            'stakes' => $stakes,
            'transfers' => $transfers,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeStake(IcoStake $s): array
    {
        $intervalHours = max(1, (int) config('ico.claim.interval_hours', 24));
        $anchor = $s->last_claim_at ?? $s->purchased_at ?? $s->created_at;
        $nextClaimAt = $anchor?->copy()->addHours($intervalHours);
        $canClaim = $s->status === IcoStake::STATUS_ACTIVE
            && ($nextClaimAt === null || $nextClaimAt->isPast());

        $dailyReward = number_format(
            (float) $s->race_amount * ((float) $s->daily_reward_percent / 100),
            4,
            '.',
            ''
        );

        return [
            'id' => $s->id,
            'phase_id' => $s->phase_id,
            'purchase_price_usd' => number_format((float) $s->purchase_price_usd, 8, '.', ''),
            'usdt_paid' => number_format((float) $s->usdt_paid, 2, '.', ''),
            'race_amount' => number_format((float) $s->race_amount, 8, '.', ''),
            'duration_days' => $s->duration_days,
            'daily_reward_percent' => number_format((float) $s->daily_reward_percent, 4, '.', ''),
            'daily_reward_race_coin' => $dailyReward,
            'status' => $s->status,
            'tx_hash' => $s->tx_hash,
            'purchased_at' => $s->purchased_at?->toIso8601String(),
            'unlock_at' => $s->unlock_at?->toIso8601String(),
            'last_claim_at' => $s->last_claim_at?->toIso8601String(),
            'next_claim_at' => $nextClaimAt?->toIso8601String(),
            'can_claim' => $canClaim,
            'total_claimed_race_coin' => number_format((float) $s->total_claimed_race_coin, 4, '.', ''),
            'claim_count' => (int) $s->claim_count,
            'is_unlocked' => $s->isUnlocked(),
            'tier_label' => $s->meta['tier_label'] ?? ($s->duration_days.' Days'),
        ];
    }
}
