<?php

namespace App\Support;

class BlockchainMode
{
    /** Project TestnetMockUSDT on BSC Testnet — only used when APP_ENV is not production. */
    private const TESTNET_USDT = '0xe30fb617215c4eb5a0e4e6b1a5f537c0e28c8fec';

    /**
     * Chain ID for Web3 UI and wallet switching.
     * Production always follows BSC_CHAIN_ID (live = mainnet 56). Testnet USDT only forces 97 outside production.
     */
    public static function effectiveChainId(): int
    {
        $chainId = (int) config('blockchain.chain_id', 56);

        if (app()->environment('production')) {
            return $chainId > 0 ? $chainId : 56;
        }

        $usdt = strtolower(trim((string) config('blockchain.contracts.usdt', '')));

        if ($usdt === self::TESTNET_USDT) {
            return 97;
        }

        return $chainId > 0 ? $chainId : 56;
    }

    public static function blockchainOnly(): bool
    {
        return config('blockchain.rewards_engine') === 'blockchain_only';
    }

    /**
     * On-chain participation/ICO enabled for the active network.
     * Testnet (97): enabled when CommunityEngine is configured.
     * Mainnet: unchanged — requires explicit env flags only.
     */
    public static function onChainEnabled(): bool
    {
        $chainId = self::effectiveChainId();
        $engine = trim((string) config('blockchain.contracts.community_engine', ''));

        if ($chainId === 97) {
            return $engine !== '';
        }

        return self::blockchainOnly()
            || (bool) config('participation_contract.on_chain.enabled', false);
    }

    public static function assertReadOnlyRewards(): void
    {
        if (self::blockchainOnly()) {
            throw new \RuntimeException(
                'Laravel reward calculation is disabled. Blockchain is the only rewards engine.',
            );
        }
    }
}