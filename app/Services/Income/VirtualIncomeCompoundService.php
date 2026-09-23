<?php

namespace App\Services\Income;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use App\Services\Blockchain\CompoundTransactionVerifier;
use App\Support\BlockchainMode;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Compound USDT-notional virtual income into on-chain Engine stake (user-initiated mint path only).
 */
class VirtualIncomeCompoundService
{
    public function __construct(
        protected VirtualIncomeWalletService $virtualWallet,
        protected CompoundTransactionVerifier $verifier,
    ) {}

    /**
     * Reserve virtual balance and record pending compound until tx is verified.
     *
     * @return array{transaction_id: int, idempotency_key: string, phase: string}
     */
    public function reserve(User $user, string $amountUsd, string $idempotencyKey, int $stakeIndex): array
    {
        BlockchainMode::assertReadOnlyRewards();

        $amount = number_format((float) $amountUsd, 2, '.', '');
        if (bccomp($amount, '0.01', 2) < 0) {
            throw ValidationException::withMessages([
                'amount_usd' => __('Compound amount must be at least $0.01.'),
            ]);
        }

        if ($idempotencyKey === '') {
            throw ValidationException::withMessages([
                'idempotency_key' => __('Idempotency key is required.'),
            ]);
        }

        return DB::transaction(function () use ($user, $amount, $idempotencyKey, $stakeIndex) {
            $existing = IncomeWalletTransaction::query()
                ->where('user_id', $user->id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                $meta = is_array($existing->metadata) ? $existing->metadata : [];

                return [
                    'transaction_id' => $existing->id,
                    'idempotency_key' => $idempotencyKey,
                    'phase' => (string) ($meta['phase'] ?? 'reserved'),
                ];
            }

            $ttlHours = (int) config('virtual_income_wallet.compound_reserve_ttl_hours', 24);

            $row = $this->virtualWallet->debit(
                $user,
                IncomeWalletTransaction::TYPE_COMPOUND,
                $amount,
                "engine_stake:{$stakeIndex}",
                $idempotencyKey,
                [
                    'stake_index' => $stakeIndex,
                    'phase' => 'reserved',
                    'on_chain_required' => true,
                    'reserved_until' => now()->addHours($ttlHours)->toIso8601String(),
                ],
            );

            return [
                'transaction_id' => $row->id,
                'idempotency_key' => $idempotencyKey,
                'phase' => 'reserved',
            ];
        });
    }

    /**
     * Verify on-chain compound tx and finalize, or refund on failure.
     */
    public function confirmOnChain(User $user, string $idempotencyKey, string $txHash): IncomeWalletTransaction
    {
        $txHash = strtolower(trim($txHash));
        if (! preg_match('/^0x[a-f0-9]{64}$/', $txHash)) {
            throw ValidationException::withMessages([
                'tx_hash' => __('Invalid transaction hash.'),
            ]);
        }

        $row = IncomeWalletTransaction::query()
            ->where('user_id', $user->id)
            ->where('idempotency_key', $idempotencyKey)
            ->firstOrFail();

        $meta = is_array($row->metadata) ? $row->metadata : [];
        if (($meta['phase'] ?? '') === 'confirmed_on_chain' && ($meta['tx_hash'] ?? '') === $txHash) {
            return $row;
        }

        $stakeIndex = (int) ($meta['stake_index'] ?? 0);
        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($wallet === '') {
            $this->refundReserve($user, $idempotencyKey, 'missing_wallet');

            throw ValidationException::withMessages([
                'wallet_address' => __('Connect your wallet before confirming compound.'),
            ]);
        }

        $verify = $this->verifier->verify($txHash, $wallet, $stakeIndex);
        if (! $verify['ok']) {
            $this->refundReserve($user, $idempotencyKey, (string) ($verify['reason'] ?? 'verify_failed'));

            throw ValidationException::withMessages([
                'tx_hash' => __('On-chain compound verification failed: :reason', [
                    'reason' => (string) ($verify['reason'] ?? 'unknown'),
                ]),
            ]);
        }

        return DB::transaction(function () use ($user, $idempotencyKey, $txHash, $verify) {
            $row = IncomeWalletTransaction::query()
                ->where('user_id', $user->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->firstOrFail();

            $meta = is_array($row->metadata) ? $row->metadata : [];
            if (($meta['phase'] ?? '') === 'confirmed_on_chain' && ($meta['tx_hash'] ?? '') === $txHash) {
                return $row;
            }

            $dup = IncomeWalletTransaction::query()
                ->where('type', IncomeWalletTransaction::TYPE_COMPOUND)
                ->where('metadata->tx_hash', $txHash)
                ->where('id', '!=', $row->id)
                ->exists();
            if ($dup) {
                throw ValidationException::withMessages([
                    'tx_hash' => __('This compound transaction was already recorded.'),
                ]);
            }

            $meta['tx_hash'] = $txHash;
            $meta['phase'] = 'confirmed_on_chain';
            $meta['verified_log_index'] = $verify['log_index'];
            $row->forceFill(['metadata' => $meta])->save();

            return $row;
        });
    }

    public function refundReserve(User $user, string $idempotencyKey, string $reason): ?IncomeWalletTransaction
    {
        if ($idempotencyKey === '') {
            return null;
        }

        return DB::transaction(function () use ($user, $idempotencyKey, $reason) {
            $debit = IncomeWalletTransaction::query()
                ->where('user_id', $user->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();

            if (! $debit) {
                return null;
            }

            $meta = is_array($debit->metadata) ? $debit->metadata : [];
            if (($meta['phase'] ?? '') === 'refunded') {
                return null;
            }
            if (($meta['phase'] ?? '') === 'confirmed_on_chain') {
                return null;
            }

            $refundKey = "compound_refund:{$idempotencyKey}";
            $existingRefund = IncomeWalletTransaction::query()
                ->where('user_id', $user->id)
                ->where('idempotency_key', $refundKey)
                ->first();
            if ($existingRefund) {
                $meta['phase'] = 'refunded';
                $debit->forceFill(['metadata' => $meta])->save();

                return $existingRefund;
            }

            $amount = number_format((float) $debit->amount, 4, '.', '');
            $credit = $this->virtualWallet->credit(
                $user,
                IncomeWalletTransaction::TYPE_COMPOUND_REFUND,
                $amount,
                $debit->source_reference,
                $refundKey,
                [
                    'compound_debit_id' => $debit->id,
                    'refund_reason' => $reason,
                ],
            );

            $meta['phase'] = 'refunded';
            $meta['refund_reason'] = $reason;
            $debit->forceFill(['metadata' => $meta])->save();

            return $credit;
        });
    }
}
