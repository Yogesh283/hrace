<?php

namespace App\Services\Blockchain;

/**
 * Read-only eth_call helpers for RaceCommunityEngine.stakeAt (no writes).
 */
final class CommunityEngineRpcReader
{
    private const STAKE_AT_SELECTOR = '997db02d';

    public function __construct(
        private readonly BscJsonRpcClient $rpc,
        private readonly string $engineAddress,
    ) {}

    public static function fromConfig(): ?self
    {
        $address = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));
        if ($address === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $address)) {
            return null;
        }

        return new self(BscJsonRpcClient::fromConfig(), $address);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function readStakeAt(string $walletAddress, int $stakeIndex): ?array
    {
        $wallet = strtolower(trim($walletAddress));
        if (! preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
            return null;
        }

        $data = '0x'.self::STAKE_AT_SELECTOR
            .str_pad(substr($wallet, 2), 64, '0', STR_PAD_LEFT)
            .str_pad(dechex(max(0, $stakeIndex)), 64, '0', STR_PAD_LEFT);

        $hex = $this->rpc->call('eth_call', [[
            'to' => $this->engineAddress,
            'data' => $data,
        ], 'latest']);

        if (! is_string($hex) || strlen($hex) < 514) {
            return null;
        }

        $raw = \App\Support\Hex::stripPrefix($hex);
        $words = [];
        for ($i = 0; $i < 8; $i++) {
            $slice = substr($raw, $i * 64, 64);
            $words[] = $this->hexWordToDecimal($slice);
        }

        return [
            'principal_usdt' => $this->weiToToken($words[0]),
            'staked_race' => $this->weiToToken($words[1]),
            'lock_seconds' => (int) $words[2],
            'started_at' => (int) $words[3],
            'unlock_at' => (int) $words[4],
            'daily_rate_bps' => (int) $words[6],
            'withdrawn' => (int) $words[7] === 1,
        ];
    }

    private function hexWordToDecimal(string $hex64): string
    {
        $hex = ltrim($hex64, '0');

        if ($hex === '') {
            return '0';
        }

        return function_exists('gmp_init')
            ? gmp_strval(gmp_init($hex, 16), 10)
            : (string) hexdec($hex);
    }

    private function weiToToken(string $wei): string
    {
        if (! function_exists('bcdiv')) {
            return number_format(((float) $wei) / 1e18, 18, '.', '');
        }

        return bcdiv($wei, '1000000000000000000', 18);
    }
}
