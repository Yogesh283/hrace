<?php

namespace App\Services\Income;

use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\UserWallet;
use App\Support\BlockchainMode;

class LedgerWriter
{
    /**
     * @param  array<string, mixed>|null  $meta
     */
    public function record(
        User $user,
        string $entryType,
        string $signedAmountUsd,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?array $meta = null,
    ): LedgerEntry {
        if (BlockchainMode::blockchainOnly()) {
            throw new \RuntimeException(
                'Ledger credits are disabled in blockchain_only mode. Rewards are paid on-chain.',
            );
        }

        \App\Support\IncomeVaultFinancialAuthority::assertLedgerIncomeMutationAllowed($entryType);

        $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

        UserWallet::query()->firstOrCreate(
            ['user_id' => $locked->id],
            ['balance_usd' => $locked->balance_usd],
        );

        $wallet = UserWallet::query()
            ->where('user_id', $locked->id)
            ->lockForUpdate()
            ->firstOrFail();

        $baseBal = (string) $wallet->balance_usd;
        // Balance stored at 2 dp; amount may be 4 dp (e.g. small network-ROI shares).
        $newBal = bcadd($baseBal, $signedAmountUsd, 4);
        $newBal = number_format((float) $newBal, 2, '.', ''); // wallet always 2 dp

        $entry = LedgerEntry::query()->create([
            'user_id' => $locked->id,
            'entry_type' => $entryType,
            'amount_usd' => $signedAmountUsd,
            'balance_after_usd' => $newBal,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'meta' => $meta,
        ]);

        $wallet->forceFill(['balance_usd' => $newBal])->save();
        $locked->forceFill(['balance_usd' => $newBal])->save();

        if (bccomp($signedAmountUsd, '0', 4) !== 0) {
            try {
                app(VirtualIncomeWalletService::class)->mirrorLedgerEntry($entry);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $entry;
    }

    /**
     * Audit ledger row that does not change withdrawable wallet balance (e.g. ROI accrual).
     *
     * @param  array<string, mixed>|null  $meta
     */
    public function recordAccrual(
        User $user,
        string $entryType,
        string $positiveAmountUsd,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?array $meta = null,
    ): LedgerEntry {
        if (BlockchainMode::blockchainOnly()) {
            throw new \RuntimeException(
                'Ledger accrual is disabled in blockchain_only mode. Rewards are paid on-chain.',
            );
        }

        $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

        UserWallet::query()->firstOrCreate(
            ['user_id' => $locked->id],
            ['balance_usd' => $locked->balance_usd],
        );

        $wallet = UserWallet::query()
            ->where('user_id', $locked->id)
            ->lockForUpdate()
            ->firstOrFail();

        $balanceSnapshot = number_format((float) $wallet->balance_usd, 2, '.', '');

        return LedgerEntry::query()->create([
            'user_id' => $locked->id,
            'entry_type' => $entryType,
            'amount_usd' => $positiveAmountUsd,
            'balance_after_usd' => $balanceSnapshot,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'meta' => array_merge($meta ?? [], ['affects_wallet' => false]),
        ]);
    }
}
