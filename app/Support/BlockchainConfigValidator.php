<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Fail-fast guards so testnet addresses are never paired with mainnet chain id (and vice versa).
 */
final class BlockchainConfigValidator
{
    private const TESTNET_MOCK_USDT = '0xe30fb617215c4eb5a0e4e6b1a5f537c0e28c8fec';

    private const MAINNET_USDT = '0x55d398326f99059ff775485246999027b3197955';

    public static function validateBoot(): void
    {
        if (! app()->runningInConsole() && ! app()->runningUnitTests()) {
            self::assertOrThrow();
        }
    }

    public static function assertOrThrow(): void
    {
        $chainId = (int) config('blockchain.chain_id', 56);
        $usdt = strtolower(trim((string) config('blockchain.contracts.usdt', '')));
        $engine = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));
        $deprecatedEngine = '0xc0d9dee1476d67379069444a7e5f1b340f91f4e9';

        if ($chainId === 97) {
            if ($usdt !== '' && $usdt === self::MAINNET_USDT) {
                throw new \RuntimeException(
                    'BLOCKCHAIN CONFIG: BSC_CHAIN_ID=97 but USDT is mainnet address — refused.',
                );
            }
            if ($engine === $deprecatedEngine) {
                throw new \RuntimeException(
                    'BLOCKCHAIN CONFIG: RACE_COMMUNITY_ENGINE_CONTRACT still points to deprecated engine 0xc0D9… — update after C-1 redeploy.',
                );
            }

            return;
        }

        if ($chainId === 56) {
            if ($usdt === self::TESTNET_MOCK_USDT) {
                throw new \RuntimeException(
                    'BLOCKCHAIN CONFIG: BSC_CHAIN_ID=56 with TestnetMockUSDT — refused.',
                );
            }
            if (filter_var(env('CONFIRM_TESTNET_DEPLOYMENT'), FILTER_VALIDATE_BOOL)) {
                throw new \RuntimeException(
                    'BLOCKCHAIN CONFIG: CONFIRM_TESTNET_DEPLOYMENT set while chain_id=56 — refused.',
                );
            }

            return;
        }

        Log::warning('BlockchainConfigValidator: non-standard chain_id configured', ['chain_id' => $chainId]);
    }
}
