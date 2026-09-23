<?php

namespace App\Support;

/**
 * RaceParticipation.sol is deprecated on testnet; active product path uses RaceCommunityEngine only.
 */
final class LegacyParticipationGuard
{
    public static function applicationEnabled(): bool
    {
        return filter_var(
            config('participation_contract.legacy.application_enabled', false),
            FILTER_VALIDATE_BOOL,
        );
    }

    public static function legacyContractAddress(): string
    {
        $fromBlockchain = strtolower(trim((string) config('blockchain.contracts.participation', '')));
        if ($fromBlockchain !== '') {
            return $fromBlockchain;
        }

        return strtolower(trim((string) config('participation_contract.on_chain.participation_contract', '')));
    }

    public static function isLegacyParticipationContract(string $contract): bool
    {
        $legacy = self::legacyContractAddress();
        if ($legacy === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $legacy)) {
            return false;
        }

        return strtolower(trim($contract)) === $legacy;
    }

    public static function blockReasonForContract(string $contract): ?string
    {
        if (self::applicationEnabled()) {
            return null;
        }

        if (self::isLegacyParticipationContract($contract)) {
            return __('Legacy RaceParticipation is disabled. Use RaceCommunityEngine.');
        }

        return null;
    }

    public static function assertApplicationAllowed(): void
    {
        if (! self::applicationEnabled()) {
            throw new \RuntimeException(
                (string) __('Legacy RaceParticipation routes are disabled. Use Community Engine staking.'),
            );
        }
    }
}
