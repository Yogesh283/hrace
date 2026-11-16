<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEngineStake;
use App\Models\BlockchainParticipation;
use App\Models\Investment;
use App\Models\User;
use App\Models\UserFundTransaction;
use App\Services\Income\IncomeDispatcher;
use App\Services\Income\InvestmentRecorder;
use App\Services\Ledger\UserFundTransactionRecorder;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Ensures ICO/Engine stakes appear in investments + fund ledger without relying on UI click.
 */
final class IcoStakeInvestmentCreditor
{
    public function __construct(
        private readonly IncomeDispatcher $dispatcher,
        private readonly UserFundTransactionRecorder $fundLedger,
    ) {}

    /**
     * Credit Active package + fund row for an indexed engine stake if missing.
     *
     * @return bool true when a new investment was created
     */
    public function creditFromEngineStake(BlockchainEngineStake $stake): bool
    {
        if (! Schema::hasTable('investments') || ! Schema::hasTable('blockchain_participations')) {
            return false;
        }

        $userId = (int) ($stake->user_id ?? 0);
        if ($userId <= 0) {
            return false;
        }

        $user = User::query()->find($userId);
        if (! $user) {
            return false;
        }

        $txHash = strtolower(trim((string) ($stake->tx_hash ?? '')));
        $stakeIndex = (int) $stake->stake_index;
        $wallet = strtolower(trim((string) $stake->wallet_address));

        if ($wallet === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
            return false;
        }

        if ($txHash !== '' && preg_match('/^0x[a-f0-9]{64}$/', $txHash)) {
            if (BlockchainParticipation::query()
                ->where('tx_hash', $txHash)
                ->where('stake_index', $stakeIndex)
                ->exists()) {
                return false;
            }
        }

        if (BlockchainParticipation::query()
            ->where('wallet_address', $wallet)
            ->where('stake_index', $stakeIndex)
            ->exists()) {
            return false;
        }

        $principal = number_format((float) $stake->principal_usdt, 2, '.', '');
        if (bccomp($principal, '0.01', 2) < 0) {
            return false;
        }

        $lockSeconds = (int) $stake->lock_seconds;
        $lockDays = $lockSeconds === 0 ? 0 : (int) round($lockSeconds / 86400);
        $lockDays = max(0, $lockDays);
        $dailyPct = RewardPlan::growthDailyPercentForDuration($lockDays) ?? 0.0;

        $placeholderTx = ($txHash !== '' && preg_match('/^0x[a-f0-9]{64}$/', $txHash))
            ? $txHash
            : ('0x'.str_pad(dechex((int) $stake->id), 64, '0', STR_PAD_LEFT));

        $contract = strtolower(trim((string) ($stake->contract_address
            ?: config('blockchain.contracts.community_engine', ''))));

        try {
            DB::transaction(function () use (
                $user,
                $stake,
                $wallet,
                $placeholderTx,
                $stakeIndex,
                $principal,
                $lockDays,
                $lockSeconds,
                $dailyPct,
                $contract,
            ) {
                $user->activateIdAndLockWithdrawalsAfterStake();

                if (\App\Support\BlockchainMode::blockchainOnly()) {
                    $participation = BlockchainParticipation::query()->create([
                        'user_id' => $user->id,
                        'investment_id' => null,
                        'wallet_address' => $wallet,
                        'tx_hash' => $placeholderTx,
                        'stake_index' => $stakeIndex,
                        'principal_usdt' => $stake->principal_usdt,
                        'lock_seconds' => $lockSeconds,
                        'daily_rate_bps' => (int) ($stake->daily_rate_bps ?? 0),
                        'contract_address' => $contract,
                        'synced_at' => now(),
                    ]);

                    $this->fundLedger->record(
                        $user,
                        UserFundTransaction::TYPE_ICO_STAKE,
                        UserFundTransaction::DIR_IN,
                        $principal,
                        $stake->staked_race !== null ? (string) $stake->staked_race : null,
                        $placeholderTx,
                        $stakeIndex,
                        BlockchainParticipation::class,
                        $participation->id,
                        'Auto-index ICO stake',
                        ['engine_stake_id' => $stake->id],
                    );

                    return;
                }

                $investment = Investment::query()->create([
                    'user_id' => $user->id,
                    'amount_usd' => $principal,
                    'duration_days' => $lockDays,
                    'roi_percent_monthly' => number_format($dailyPct * 30, 2, '.', ''),
                    'roi_percent_daily' => number_format($dailyPct, 4, '.', ''),
                    'total_roi_paid_usd' => '0.00',
                    'roi_payouts_done' => 0,
                    'cap_multiplier' => '1.00',
                    'status' => Investment::STATUS_ACTIVE,
                    'next_roi_at' => null,
                ]);

                $participation = BlockchainParticipation::query()->create([
                    'user_id' => $user->id,
                    'investment_id' => $investment->id,
                    'wallet_address' => $wallet,
                    'tx_hash' => $placeholderTx,
                    'stake_index' => $stakeIndex,
                    'principal_usdt' => $stake->principal_usdt,
                    'lock_seconds' => $lockSeconds,
                    'daily_rate_bps' => (int) ($stake->daily_rate_bps ?? 0),
                    'contract_address' => $contract,
                    'synced_at' => now(),
                ]);

                $this->dispatcher->onNewInvestment($investment, InvestmentRecorder::PAYMENT_USDT_WALLET);

                $this->fundLedger->record(
                    $user,
                    UserFundTransaction::TYPE_ICO_STAKE,
                    UserFundTransaction::DIR_IN,
                    $principal,
                    $stake->staked_race !== null ? (string) $stake->staked_race : null,
                    $placeholderTx,
                    $stakeIndex,
                    Investment::class,
                    $investment->id,
                    'Auto-index ICO stake → Active package',
                    [
                        'engine_stake_id' => $stake->id,
                        'participation_id' => $participation->id,
                    ],
                );
            });
        } catch (\Throwable $e) {
            Log::warning('IcoStakeInvestmentCreditor failed', [
                'engine_stake_id' => $stake->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        return true;
    }

    public function creditLatestForWalletStake(string $wallet, int $stakeIndex, string $contract): bool
    {
        $stake = BlockchainEngineStake::query()
            ->where('wallet_address', strtolower($wallet))
            ->where('stake_index', $stakeIndex)
            ->where('contract_address', strtolower($contract))
            ->first();

        if (! $stake) {
            return false;
        }

        return $this->creditFromEngineStake($stake);
    }
}
