<?php

namespace App\Support;

class BlockchainMode
{
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
        $chainId = (int) config('blockchain.chain_id', 56);
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