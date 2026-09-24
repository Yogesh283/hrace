<?php

namespace App\Support;

/**
 * RPC URLs aligned with effective chain (Testnet USDT / chain 97 must not hit Mainnet dataseed).
 */
final class BlockchainRpc
{
    /** @var list<string> */
    private const TESTNET_DEFAULTS = [
        'https://bsc-testnet.bnbchain.org',
        'https://bsc-testnet.publicnode.com',
        'https://data-seed-prebsc-1-s1.binance.org:8545',
    ];

    /**
     * @return list<string>
     */
    public static function effectiveRpcUrls(): array
    {
        $chainId = BlockchainMode::effectiveChainId();

        $candidates = [];
        foreach (config('blockchain.indexer.rpc_urls', []) as $url) {
            if (is_string($url) && trim($url) !== '') {
                $candidates[] = trim($url);
            }
        }
        foreach (config('blockchain.rpc_urls', []) as $url) {
            if (is_string($url) && trim($url) !== '') {
                $candidates[] = trim($url);
            }
        }
        $primary = trim((string) config('blockchain.rpc_url', ''));
        if ($primary !== '') {
            $candidates[] = $primary;
        }

        $candidates = array_values(array_unique(array_filter($candidates)));

        if ($chainId === 97) {
            $testnet = array_values(array_filter($candidates, [self::class, 'looksLikeTestnetRpc']));
            if ($testnet !== []) {
                return $testnet;
            }

            return self::TESTNET_DEFAULTS;
        }

        if ($chainId === 56) {
            $mainnet = array_values(array_filter($candidates, static fn (string $u) => ! self::looksLikeTestnetRpc($u)));
            if ($mainnet !== []) {
                return $mainnet;
            }
        }

        return $candidates !== [] ? $candidates : ['https://bsc-dataseed.binance.org/'];
    }

    public static function primaryRpcUrl(): string
    {
        $urls = self::effectiveRpcUrls();

        return $urls[0] ?? 'https://bsc-dataseed.binance.org/';
    }

    public static function looksLikeTestnetRpc(string $url): bool
    {
        $u = strtolower(trim($url));
        if ($u === '') {
            return false;
        }

        if (str_contains($u, 'prebsc') || str_contains($u, 'bsc-testnet') || str_contains($u, 'testnet')) {
            return true;
        }

        // Mainnet dataseed without prebsc/testnet
        if (str_contains($u, 'bsc-dataseed') || str_contains($u, 'dataseed.binance.org')) {
            return false;
        }

        return false;
    }
}
