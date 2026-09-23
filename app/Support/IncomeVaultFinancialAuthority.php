<?php

namespace App\Support;

use App\Models\LedgerEntry;

/**
 * Blocks Laravel-side financial mutations when on-chain income vault is authoritative.
 */
class IncomeVaultFinancialAuthority
{
    public static function isAuthoritative(): bool
    {
        return (bool) config('income_vault.enabled')
            && (bool) config('income_vault.authoritative_balance')
            && trim((string) config('income_vault.contract_address')) !== '';
    }

    public static function assertVirtualWalletMutationAllowed(): void
    {
        if (! self::isAuthoritative()) {
            return;
        }

        throw new \RuntimeException(
            'Virtual Income Wallet is read-model only (INCOME_VAULT_AUTHORITATIVE). '
            .'Settle income on RaceIncomeVault via signed settlement.',
        );
    }

    public static function assertLedgerIncomeMutationAllowed(string $entryType): void
    {
        if (! self::isAuthoritative()) {
            return;
        }

        if (in_array($entryType, self::ledgerTypesBlockedWhenAuthoritative(), true)) {
            throw new \RuntimeException(
                "Ledger entry type [{$entryType}] blocked while INCOME_VAULT_AUTHORITATIVE is enabled.",
            );
        }
    }

    /**
     * @return list<string>
     */
    public static function ledgerTypesBlockedWhenAuthoritative(): array
    {
        return [
            LedgerEntry::TYPE_ROI_DAILY,
            LedgerEntry::TYPE_ROI_MONTHLY,
            LedgerEntry::TYPE_ROI_ACCRUAL,
            LedgerEntry::TYPE_INCOME_CLAIM,
            LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI,
            LedgerEntry::TYPE_COMMUNITY_TEAM_REWARD,
            LedgerEntry::TYPE_COMMUNITY_REFERRAL,
            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP,
            LedgerEntry::TYPE_COMMUNITY_LEADERSHIP_RANK11_MONTHLY,
            LedgerEntry::TYPE_AFFILIATE_R10_LEADERSHIP,
            LedgerEntry::TYPE_WALLET_WITHDRAWAL,
        ];
    }

    public static function isReadModelMirrorWrite(?array $metadata): bool
    {
        if (! self::isAuthoritative()) {
            return false;
        }

        return ($metadata['read_model_mirror'] ?? false) === true;
    }

    public static function assertAdminWalletEditAllowed(): void
    {
        if (! self::isAuthoritative()) {
            return;
        }

        throw new \RuntimeException(
            'Manual admin wallet balance edits are disabled when INCOME_VAULT_AUTHORITATIVE is enabled.',
        );
    }
}
