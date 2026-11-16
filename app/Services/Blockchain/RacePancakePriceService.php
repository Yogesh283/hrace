<?php

namespace App\Services\Blockchain;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Live RACE/USDT from Pancake via Engine / RaceICO view helpers (same as createStake).
 */
final class RacePancakePriceService
{
    private const ICO_LIVE_STAKE_PRICE = '0x925dbb46';

    private const ENGINE_LIVE_RACE_PRICE = '0xfc9e193f';

    private const CACHE_KEY = 'race.pancake.price_usd';

    private const CACHE_TTL_SECONDS = 60;

    /**
     * USDT per 1 RACE (human float). Null when pool/RPC unavailable.
     */
    public function priceUsd(): ?float
    {
        try {
            $cached = Cache::get(self::CACHE_KEY);
            if (is_float($cached) || is_int($cached)) {
                $asFloat = (float) $cached;

                return $asFloat > 0 ? $asFloat : null;
            }
        } catch (\Throwable) {
            // Cache store unavailable — still fetch live price.
        }

        $price = $this->fetchLivePriceUsd();
        if ($price !== null && $price > 0) {
            try {
                Cache::put(self::CACHE_KEY, $price, self::CACHE_TTL_SECONDS);
            } catch (\Throwable) {
                // ignore cache write failures
            }
        }

        return $price;
    }

    private function fetchLivePriceUsd(): ?float
    {
        try {
            $rpc = BscJsonRpcClient::fromConfig();
            $ico = strtolower(trim((string) config('blockchain.contracts.ico', '')));
            $engine = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));

            $wei = null;
            if ($ico !== '' && str_starts_with($ico, '0x') && strlen($ico) === 42) {
                $wei = $this->readUint256($rpc, $ico, self::ICO_LIVE_STAKE_PRICE);
            }
            if (($wei === null || $wei === '0') && $engine !== '' && str_starts_with($engine, '0x') && strlen($engine) === 42) {
                $wei = $this->readUint256($rpc, $engine, self::ENGINE_LIVE_RACE_PRICE);
            }

            if ($wei === null || $wei === '0') {
                return null;
            }

            // 18-decimal USDT-notional per 1 RACE
            if (function_exists('bcdiv')) {
                $human = bcdiv($wei, bcpow('10', '18', 0), 8);

                return (float) $human;
            }

            return ((float) $wei) / 1e18;
        } catch (\Throwable $e) {
            Log::warning('Race Pancake price fetch failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function readUint256(BscJsonRpcClient $rpc, string $to, string $selector): ?string
    {
        $hex = $rpc->call('eth_call', [[
            'to' => $to,
            'data' => $selector,
        ], 'latest']);

        if (! is_string($hex) || $hex === '' || $hex === '0x') {
            return null;
        }

        $hex = strtolower(ltrim($hex, '0x'));
        if ($hex === '') {
            return '0';
        }

        return $this->hexToDec($hex);
    }

    private function hexToDec(string $hex): string
    {
        if (function_exists('gmp_init')) {
            return gmp_strval(gmp_init($hex, 16), 10);
        }

        $dec = '0';
        $len = strlen($hex);
        for ($i = 0; $i < $len; $i++) {
            $dec = bcmul($dec, '16', 0);
            $dec = bcadd($dec, (string) hexdec($hex[$i]), 0);
        }

        return $dec;
    }
}
