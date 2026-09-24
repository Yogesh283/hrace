<?php

namespace App\Services\Blockchain;

use Illuminate\Support\Facades\Http;

/**
 * BSC JSON-RPC client with endpoint fallback, retries, and chunked eth_getLogs.
 */
final class BscJsonRpcClient
{
    /** @var list<string> */
    private array $rpcUrls;

    public function __construct(
        array $rpcUrls,
        private readonly int $expectedChainId,
        private readonly int $timeoutSeconds = 25,
        private readonly int $maxRetries = 3,
    ) {
        $this->rpcUrls = array_values(array_unique(array_filter(array_map(
            static fn ($url) => is_string($url) ? trim($url) : '',
            $rpcUrls,
        ))));
    }

    public static function fromConfig(): self
    {
        $urls = \App\Support\BlockchainRpc::effectiveRpcUrls();

        return new self(
            $urls,
            \App\Support\BlockchainMode::effectiveChainId(),
            max(5, (int) config('blockchain.indexer.rpc_timeout', 25)),
            max(1, min(5, (int) config('blockchain.indexer.rpc_retries', 3))),
        );
    }

    /**
     * @return list<string>
     */
    public function rpcUrls(): array
    {
        return $this->rpcUrls;
    }

    public function redactUrl(string $url): string
    {
        $parts = parse_url($url);

        return ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? 'unknown');
    }

    /**
     * @param  list<mixed>  $params
     */
    public function call(string $method, array $params): mixed
    {
        if ($this->rpcUrls === []) {
            return null;
        }

        $lastError = null;

        foreach ($this->rpcUrls as $rpcUrl) {
            for ($attempt = 1; $attempt <= $this->maxRetries; $attempt++) {
                try {
                    $response = Http::timeout($this->timeoutSeconds)->post($rpcUrl, [
                        'jsonrpc' => '2.0',
                        'id' => 1,
                        'method' => $method,
                        'params' => $params,
                    ]);
                } catch (\Throwable $e) {
                    $lastError = $e->getMessage();
                    if ($attempt < $this->maxRetries && $this->isTransientMessage($lastError)) {
                        usleep($this->backoffMicros($attempt));

                        continue;
                    }

                    break;
                }

                if (! $response->successful()) {
                    $lastError = "HTTP {$response->status()} on {$this->redactUrl($rpcUrl)}";
                    if ($attempt < $this->maxRetries && $this->isTransientMessage($lastError)) {
                        usleep($this->backoffMicros($attempt));

                        continue;
                    }

                    break;
                }

                $error = $response->json('error');
                if (is_array($error)) {
                    $message = (string) ($error['message'] ?? 'RPC error');
                    $code = $error['code'] ?? null;
                    $lastError = "{$message}".($code !== null ? " (code {$code})" : '');
                    if ($attempt < $this->maxRetries && $this->isTransientRpcError($error)) {
                        usleep($this->backoffMicros($attempt));

                        continue;
                    }

                    break;
                }

                return $response->json('result');
            }
        }

        return null;
    }

    public function assertExpectedChain(): ?int
    {
        $live = $this->call('eth_chainId', []);
        if (! is_string($live)) {
            return null;
        }

        $chainId = hexdec($live);
        if ($chainId !== $this->expectedChainId) {
            return null;
        }

        return $chainId;
    }

    /**
     * @return list<array<string, mixed>>|null null = RPC failure
     */
    public function getLogs(string $contractAddress, int $fromBlock, int $toBlock, int $chunkSize): ?array
    {
        if ($fromBlock > $toBlock) {
            return [];
        }

        $chunkSize = max(1, $chunkSize);
        $merged = [];

        for ($start = $fromBlock; $start <= $toBlock; $start += $chunkSize) {
            $end = min($start + $chunkSize - 1, $toBlock);
            $chunkLogs = $this->getLogsRange($contractAddress, $start, $end);
            if ($chunkLogs === null) {
                return null;
            }
            array_push($merged, ...$chunkLogs);
        }

        usort($merged, static function (array $a, array $b): int {
            $blockA = hexdec((string) ($a['blockNumber'] ?? '0x0'));
            $blockB = hexdec((string) ($b['blockNumber'] ?? '0x0'));
            if ($blockA !== $blockB) {
                return $blockA <=> $blockB;
            }

            return hexdec((string) ($a['logIndex'] ?? '0x0')) <=> hexdec((string) ($b['logIndex'] ?? '0x0'));
        });

        return $merged;
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    private function getLogsRange(string $contractAddress, int $fromBlock, int $toBlock, int $depth = 0): ?array
    {
        if ($fromBlock > $toBlock) {
            return [];
        }

        $result = $this->call('eth_getLogs', [[
            'address' => $contractAddress,
            'fromBlock' => '0x'.dechex($fromBlock),
            'toBlock' => '0x'.dechex($toBlock),
        ]]);

        if (is_array($result)) {
            return $result;
        }

        if ($fromBlock === $toBlock || $depth >= 12) {
            return null;
        }

        $mid = intdiv($fromBlock + $toBlock, 2);
        $left = $this->getLogsRange($contractAddress, $fromBlock, $mid, $depth + 1);
        if ($left === null) {
            return null;
        }
        $right = $this->getLogsRange($contractAddress, $mid + 1, $toBlock, $depth + 1);
        if ($right === null) {
            return null;
        }

        return array_merge($left, $right);
    }

    /**
     * @param  array<string, mixed>  $error
     */
    private function isTransientRpcError(array $error): bool
    {
        $message = strtolower((string) ($error['message'] ?? ''));
        $code = $error['code'] ?? null;

        if ($code === -32005 || $code === -32000) {
            return true;
        }

        return $this->isTransientMessage($message);
    }

    private function isTransientMessage(string $message): bool
    {
        $message = strtolower($message);

        return str_contains($message, 'limit exceeded')
            || str_contains($message, 'timeout')
            || str_contains($message, 'timed out')
            || str_contains($message, 'rate limit')
            || str_contains($message, 'too many')
            || str_contains($message, 'connection')
            || str_contains($message, 'temporarily unavailable')
            || str_contains($message, '502')
            || str_contains($message, '503')
            || str_contains($message, '504');
    }

    private function backoffMicros(int $attempt): int
    {
        return min(2_000_000, 200_000 * (2 ** max(0, $attempt - 1)));
    }
}
