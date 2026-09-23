<?php

namespace App\Services\Blockchain;

use Illuminate\Support\Facades\Config;
use kornrunner\Keccak;

/**
 * EIP-712 signing for RaceIncomeVault settlements (matches Solidity domain + type hashes).
 */
class IncomeVaultSettlementSigner
{
    public function domainSeparator(string $vaultAddress, int $chainId): string
    {
        $typeHash = Keccak::hash('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)', 256);
        $nameHash = Keccak::hash(Config::get('income_vault.domain.name', 'RaceIncomeVault'), 256);
        $versionHash = Keccak::hash(Config::get('income_vault.domain.version', '1'), 256);

        return Keccak::hash(
            hex2bin(substr($typeHash, 2))
            .hex2bin(substr($nameHash, 2))
            .hex2bin(substr($versionHash, 2))
            .str_pad(dechex($chainId), 64, '0', STR_PAD_LEFT)
            .str_pad(substr(strtolower($vaultAddress), 2), 64, '0', STR_PAD_LEFT),
            256,
        );
    }

    public function hashTypedDataV4(string $domainSeparator, string $structHash): string
    {
        return Keccak::hash(
            "\x19\x01".hex2bin(substr($domainSeparator, 2)).hex2bin(substr($structHash, 2)),
            256,
        );
    }

    public function creditStructHash(
        string $userAddress,
        string $amountWei,
        string $incomeTypeHex32,
        string $referenceIdHex32,
        int $deadline,
    ): string {
        $typeHash = Keccak::hash(
            'CreditIncome(address user,uint256 amount,bytes32 incomeType,bytes32 referenceId,uint256 deadline)',
            256,
        );

        return Keccak::hash(
            hex2bin(substr($typeHash, 2))
            .str_pad(substr(strtolower($userAddress), 2), 64, '0', STR_PAD_LEFT)
            .str_pad(substr($amountWei, 2), 64, '0', STR_PAD_LEFT)
            .substr($incomeTypeHex32, 2)
            .substr($referenceIdHex32, 2)
            .str_pad(dechex($deadline), 64, '0', STR_PAD_LEFT),
            256,
        );
    }

    public function incomeTypeBytes32(string $laravelType): string
    {
        $label = Config::get("income_vault.income_type_labels.{$laravelType}");
        if (! is_string($label) || $label === '') {
            throw new \InvalidArgumentException("Unknown income type for vault: {$laravelType}");
        }

        return '0x'.Keccak::hash($label, 256);
    }

    public function referenceIdBytes32(string $referenceKey): string
    {
        return '0x'.Keccak::hash($referenceKey, 256);
    }

    public function migrateStructHash(
        string $userAddress,
        string $amountWei,
        string $migrationIdHex32,
        int $deadline,
    ): string {
        $typeHash = Keccak::hash(
            'MigrateIncome(address user,uint256 amount,bytes32 migrationId,uint256 deadline)',
            256,
        );

        return Keccak::hash(
            hex2bin(substr($typeHash, 2))
            .str_pad(substr(strtolower($userAddress), 2), 64, '0', STR_PAD_LEFT)
            .str_pad(substr($amountWei, 2), 64, '0', STR_PAD_LEFT)
            .substr($migrationIdHex32, 2)
            .str_pad(dechex($deadline), 64, '0', STR_PAD_LEFT),
            256,
        );
    }
}
