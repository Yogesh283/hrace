<?php

namespace App\Services\Income;

use App\Models\IncomeWalletTransaction;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Support\IncomeVaultFinancialAuthority;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Authoritative Virtual Income Wallet (USDT-notional earned income).
 * Balance = on-chain indexer when income_vault.authoritative_balance, else sum(credits) − debits (4 dp).
 */
class VirtualIncomeWalletService
{
    public function availableBalance(User $user): string
    {
        $onChain = app(\App\Services\Blockchain\OnChainIncomeReadService::class)->balanceForUser($user);
        if ($onChain !== null) {
            return $onChain;
        }

        return $this->sumBalance((int) $user->id);
    }

    public function sumBalance(int $userId): string
    {
        $credits = (string) (IncomeWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('status', IncomeWalletTransaction::STATUS_POSTED)
            ->where('direction', IncomeWalletTransaction::DIRECTION_CREDIT)
            ->where(fn ($q) => $q->where('asset', config('virtual_income_wallet.asset_default', 'USDT'))->orWhereNull('asset'))
            ->sum('amount') ?? '0');

        $debits = (string) (IncomeWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('status', IncomeWalletTransaction::STATUS_POSTED)
            ->where('direction', IncomeWalletTransaction::DIRECTION_DEBIT)
            ->where(fn ($q) => $q->where('asset', config('virtual_income_wallet.asset_default', 'USDT'))->orWhereNull('asset'))
            ->sum('amount') ?? '0');

        $bal = bcsub(
            number_format((float) $credits, 4, '.', ''),
            number_format((float) $debits, 4, '.', ''),
            4,
        );

        if (bccomp($bal, '0', 4) < 0) {
            return '0.0000';
        }

        return $bal;
    }

    /**
     * @return array{
     *     available_balance_usd: string,
     *     today_income_usd: string,
     *     total_claimed_usd: string,
     *     total_compounded_usd: string,
     *     total_withdrawn_usd: string
     * }
     */
    public function dashboardSummary(User $user): array
    {
        $userId = (int) $user->id;
        $todayStart = now()->startOfDay();

        $todayIncome = (string) (IncomeWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('status', IncomeWalletTransaction::STATUS_POSTED)
            ->where('direction', IncomeWalletTransaction::DIRECTION_CREDIT)
            ->where(fn ($q) => $q->where('asset', config('virtual_income_wallet.asset_default', 'USDT'))->orWhereNull('asset'))
            ->where('created_at', '>=', $todayStart)
            ->sum('amount') ?? '0');

        $totalClaimed = (string) (IncomeWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('status', IncomeWalletTransaction::STATUS_POSTED)
            ->where('direction', IncomeWalletTransaction::DIRECTION_CREDIT)
            ->where('type', IncomeWalletTransaction::TYPE_INCOME_CLAIM)
            ->sum('amount') ?? '0');

        $totalCompound = (string) (IncomeWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('status', IncomeWalletTransaction::STATUS_POSTED)
            ->where('direction', IncomeWalletTransaction::DIRECTION_DEBIT)
            ->where('type', IncomeWalletTransaction::TYPE_COMPOUND)
            ->sum('amount') ?? '0');

        $totalWithdrawn = (string) (IncomeWalletTransaction::query()
            ->where('user_id', $userId)
            ->where('status', IncomeWalletTransaction::STATUS_POSTED)
            ->where('direction', IncomeWalletTransaction::DIRECTION_DEBIT)
            ->where('type', IncomeWalletTransaction::TYPE_WITHDRAWAL)
            ->sum('amount') ?? '0');

        return [
            'available_balance_usd' => $this->availableBalance($user),
            'today_income_usd' => number_format((float) $todayIncome, 4, '.', ''),
            'total_claimed_usd' => number_format((float) $totalClaimed, 4, '.', ''),
            'total_compounded_usd' => number_format((float) $totalCompound, 4, '.', ''),
            'total_withdrawn_usd' => number_format((float) $totalWithdrawn, 4, '.', ''),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    public function credit(
        User $user,
        string $type,
        string $amountUsd,
        ?string $sourceReference = null,
        ?string $idempotencyKey = null,
        ?array $metadata = null,
    ): IncomeWalletTransaction {
        return $this->post($user, $type, $amountUsd, IncomeWalletTransaction::DIRECTION_CREDIT, $sourceReference, $idempotencyKey, $metadata);
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    public function debit(
        User $user,
        string $type,
        string $amountUsd,
        ?string $sourceReference = null,
        ?string $idempotencyKey = null,
        ?array $metadata = null,
    ): IncomeWalletTransaction {
        return $this->post($user, $type, $amountUsd, IncomeWalletTransaction::DIRECTION_DEBIT, $sourceReference, $idempotencyKey, $metadata);
    }

    /**
     * Mirror a legacy ledger_entries row into income_wallet_transactions (idempotent via ledger id).
     */
    public function mirrorLedgerEntry(LedgerEntry $entry): ?IncomeWalletTransaction
    {
        $entryType = (string) $entry->entry_type;
        if (in_array($entryType, config('virtual_income_wallet.mirror_exclude', []), true)) {
            return null;
        }

        $mappedType = config('virtual_income_wallet.ledger_type_map')[$entryType] ?? null;
        if ($mappedType === null) {
            return null;
        }

        $amount = number_format(abs((float) $entry->amount_usd), 4, '.', '');
        if (bccomp($amount, '0', 4) <= 0) {
            return null;
        }

        $direction = bccomp((string) $entry->amount_usd, '0', 4) >= 0
            ? IncomeWalletTransaction::DIRECTION_CREDIT
            : IncomeWalletTransaction::DIRECTION_DEBIT;

        $sourceRef = $entry->reference_type && $entry->reference_id
            ? "{$entry->reference_type}:{$entry->reference_id}"
            : "ledger:{$entry->id}";

        return $this->post(
            $entry->user,
            $mappedType,
            $amount,
            $direction,
            $sourceRef,
            "ledger_entry:{$entry->id}",
            [
                'ledger_entry_id' => $entry->id,
                'ledger_entry_type' => $entryType,
                'meta' => $entry->meta,
            ],
        );
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     */
    private function post(
        User $user,
        string $type,
        string $amountUsd,
        string $direction,
        ?string $sourceReference,
        ?string $idempotencyKey,
        ?array $metadata,
    ): IncomeWalletTransaction {
        $amount = number_format((float) $amountUsd, 4, '.', '');
        if (bccomp($amount, '0', 4) <= 0) {
            throw ValidationException::withMessages([
                'amount' => __('Amount must be greater than zero.'),
            ]);
        }

        return DB::transaction(function () use ($user, $type, $amount, $direction, $sourceReference, $idempotencyKey, $metadata) {
            if (! IncomeVaultFinancialAuthority::isReadModelMirrorWrite($metadata)) {
                IncomeVaultFinancialAuthority::assertVirtualWalletMutationAllowed();
            }

            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if ($idempotencyKey !== null && $idempotencyKey !== '') {
                $existing = IncomeWalletTransaction::query()
                    ->where('user_id', $user->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();
                if ($existing) {
                    return $existing;
                }
            }

            if ($direction === IncomeWalletTransaction::DIRECTION_DEBIT) {
                $available = $this->sumBalance((int) $user->id);
                if (bccomp($available, $amount, 4) < 0) {
                    throw ValidationException::withMessages([
                        'amount' => __('Insufficient Virtual Income Wallet balance.'),
                    ]);
                }
            }

            return IncomeWalletTransaction::query()->create([
                'user_id' => $user->id,
                'wallet_address' => $user->wallet_address,
                'type' => $type,
                'source_reference' => $sourceReference,
                'amount' => $amount,
                'asset' => config('virtual_income_wallet.asset_default', 'USDT'),
                'direction' => $direction,
                'status' => IncomeWalletTransaction::STATUS_POSTED,
                'idempotency_key' => $idempotencyKey,
                'metadata' => $metadata,
            ]);
        });
    }
}
