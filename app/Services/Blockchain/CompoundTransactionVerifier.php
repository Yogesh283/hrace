<?php

namespace App\Services\Blockchain;

/**
 * Read-only on-chain verification for Engine compoundReward transactions.
 */
class CompoundTransactionVerifier
{
    public const REWARD_COMPOUNDED_TOPIC = '0x172683bc9e168fd8e43e442d0e5392595c48b43230044dee7c406e017e52c510';

    public function __construct(
        private readonly BscJsonRpcClient $rpc,
    ) {}

    public static function make(): self
    {
        return new self(BscJsonRpcClient::fromConfig());
    }

    /**
     * @return array{ok: bool, reason: string|null, log_index: int|null}
     */
    public function verify(
        string $txHash,
        string $expectedWallet,
        int $expectedStakeIndex,
        string $minimumRewardUsdtWei = '0',
    ): array {
        $txHash = strtolower(trim($txHash));
        $expectedWallet = strtolower(trim($expectedWallet));
        $engine = strtolower((string) config('blockchain.contracts.community_engine', ''));
        $chainId = (int) config('blockchain.chain_id', 0);

        if ($chainId <= 0 || ! in_array($chainId, [56, 97], true)) {
            return ['ok' => false, 'reason' => 'chain_not_configured', 'log_index' => null];
        }
        if ($engine === '' || ! str_starts_with($engine, '0x')) {
            return ['ok' => false, 'reason' => 'engine_not_configured', 'log_index' => null];
        }

        $liveChain = $this->rpc->assertExpectedChain();
        if ($liveChain === null) {
            return ['ok' => false, 'reason' => 'rpc_chain_mismatch', 'log_index' => null];
        }

        $receipt = $this->rpc->call('eth_getTransactionReceipt', [$txHash]);
        if (! is_array($receipt)) {
            return ['ok' => false, 'reason' => 'receipt_missing', 'log_index' => null];
        }

        $status = strtolower((string) ($receipt['status'] ?? '0x0'));
        if ($status !== '0x1') {
            return ['ok' => false, 'reason' => 'receipt_failed', 'log_index' => null];
        }

        $from = strtolower((string) ($receipt['from'] ?? ''));
        if ($from !== $expectedWallet) {
            return ['ok' => false, 'reason' => 'wrong_sender', 'log_index' => null];
        }

        $logs = $receipt['logs'] ?? [];
        if (! is_array($logs)) {
            return ['ok' => false, 'reason' => 'no_logs', 'log_index' => null];
        }

        foreach ($logs as $log) {
            if (! is_array($log)) {
                continue;
            }
            $addr = strtolower((string) ($log['address'] ?? ''));
            if ($addr !== $engine) {
                continue;
            }
            $topic0 = strtolower((string) ($log['topics'][0] ?? ''));
            if ($topic0 !== self::REWARD_COMPOUNDED_TOPIC) {
                continue;
            }

            $userTopic = strtolower((string) ($log['topics'][1] ?? ''));
            $stakeTopic = (string) ($log['topics'][2] ?? '0x0');
            $decodedUser = $this->topicToAddress($userTopic);
            if ($decodedUser !== $expectedWallet) {
                return ['ok' => false, 'reason' => 'wrong_event_user', 'log_index' => null];
            }

            $stakeIndex = (int) hexdec($stakeTopic);
            if ($stakeIndex !== $expectedStakeIndex) {
                return ['ok' => false, 'reason' => 'wrong_stake_index', 'log_index' => null];
            }

            if (bccomp($minimumRewardUsdtWei, '0', 0) > 0) {
                $data = (string) ($log['data'] ?? '0x');
                $rewardUsdtWei = $this->readUint256At($data, 0);
                if (bccomp($rewardUsdtWei, $minimumRewardUsdtWei, 0) < 0) {
                    return ['ok' => false, 'reason' => 'reward_usdt_too_low', 'log_index' => null];
                }
            }

            $logIndex = isset($log['logIndex']) ? (int) hexdec((string) $log['logIndex']) : null;

            return ['ok' => true, 'reason' => null, 'log_index' => $logIndex];
        }

        return ['ok' => false, 'reason' => 'reward_compounded_missing', 'log_index' => null];
    }

    private function topicToAddress(string $topic): string
    {
        $hex = \App\Support\Hex::stripPrefix($topic);
        if (strlen($hex) < 40) {
            return '';
        }

        return '0x'.substr($hex, -40);
    }

    private function readUint256At(string $dataHex, int $wordIndex): string
    {
        $raw = \App\Support\Hex::stripPrefix($dataHex);
        if ($raw === '') {
            return '0';
        }
        $start = $wordIndex * 64;
        $slice = substr($raw, $start, 64);
        if ($slice === false || $slice === '') {
            return '0';
        }

        return \App\Support\Hex::wordToDecimal($slice);
    }
}
