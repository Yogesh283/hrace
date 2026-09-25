<?php

namespace App\Services\Blockchain;

use App\Models\SiteSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Verify USDT (BEP20) transfers for deposit / swap credit.
 *
 * Flash / fake USDT protection:
 * - Only the configured contract address is accepted (never trust symbol alone).
 * - Mainnet forces official Tether USDT; testnet forbids mainnet USDT address.
 * - Credits only ERC-20 Transfer logs emitted by that contract to the treasury.
 */
class UsdtTransferVerifier
{
    public const OFFICIAL_USDT_MAINNET = '0x55d398326f99059ff775485246999027b3197955';

    /** keccak256(Transfer(address,address,uint256)) */
    public const TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    /**
     * @return array{ok: bool, reason?: string, amount_usd?: float}
     */
    public function verifyTransferToTreasury(string $txHash, float $claimedUsd, string $fromAddress, string $purpose = 'deposit'): array
    {
        $txHash = strtolower(trim($txHash));
        $fromAddress = strtolower(trim($fromAddress));
        $adminAddress = strtolower(SiteSetting::treasuryAddress());
        $usdtContract = $this->resolvedUsdtContract();
        $usdtDecimals = (int) config('wallet.usdt_decimals', 18);
        $minConfirms = max(1, (int) config('wallet.deposit_min_confirmations', 12));
        $chainId = (int) config('blockchain.chain_id', 56);

        if ($usdtContract === '') {
            return ['ok' => false, 'reason' => 'USDT contract is not configured. Contact support.'];
        }

        if ($adminAddress === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $adminAddress)) {
            return ['ok' => false, 'reason' => 'Company deposit address is not configured.'];
        }

        if ($fromAddress === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $fromAddress)) {
            return ['ok' => false, 'reason' => 'Connect your crypto wallet before '.$purpose.'.'];
        }

        $policy = $this->assertUsdtPolicy($usdtContract, $chainId);
        if ($policy !== null) {
            return ['ok' => false, 'reason' => $policy];
        }

        try {
            $receipt = $this->rpc('eth_getTransactionReceipt', [$txHash]);
            if (! is_array($receipt) || $receipt === []) {
                return ['ok' => false, 'reason' => 'Transaction not found on chain. Please wait for confirmation.'];
            }

            if (strtolower((string) ($receipt['status'] ?? '')) !== '0x1') {
                return ['ok' => false, 'reason' => 'Transaction failed on chain.'];
            }

            $txTo = strtolower((string) ($receipt['to'] ?? ''));
            if ($txTo !== $usdtContract) {
                return [
                    'ok' => false,
                    'reason' => 'Flash / fake USDT rejected. Only the official configured USDT contract is accepted.',
                ];
            }

            $tx = $this->rpc('eth_getTransactionByHash', [$txHash]);
            if (! is_array($tx)) {
                return ['ok' => false, 'reason' => 'Could not load transaction.'];
            }

            $txFrom = strtolower((string) ($tx['from'] ?? ''));
            if ($txFrom === '' || $txFrom !== $fromAddress) {
                return ['ok' => false, 'reason' => 'Transaction sender does not match your connected wallet.'];
            }

            $txBlockHex = $receipt['blockNumber'] ?? null;
            if (! is_string($txBlockHex) || $txBlockHex === '') {
                return ['ok' => false, 'reason' => 'Could not read transaction block.'];
            }

            $currentBlockHex = $this->rpc('eth_blockNumber', []);
            if (! is_string($currentBlockHex) || $currentBlockHex === '') {
                return ['ok' => false, 'reason' => 'Could not verify block confirmations.'];
            }

            $confirmations = hexdec($currentBlockHex) - hexdec($txBlockHex) + 1;
            if ($confirmations < $minConfirms) {
                return [
                    'ok' => false,
                    'reason' => "Waiting for confirmations ({$confirmations}/{$minConfirms}). Try again shortly.",
                ];
            }

            // Token must still be a live contract (flash / self-destruct scams).
            $code = $this->rpc('eth_getCode', [$usdtContract, 'latest']);
            if (! is_string($code) || $code === '' || $code === '0x' || $code === '0x0') {
                return ['ok' => false, 'reason' => 'Flash / fake USDT rejected — token contract is invalid.'];
            }

            $amountUsd = $this->sumOfficialTransfersFromReceipt(
                $receipt['logs'] ?? [],
                $usdtContract,
                $fromAddress,
                $adminAddress,
                $usdtDecimals,
            );

            if ($amountUsd <= 0) {
                return [
                    'ok' => false,
                    'reason' => 'No official USDT transfer from your wallet to the company address was found. Fake / flash tokens are not credited.',
                ];
            }

            $tolerance = $claimedUsd * 0.01;
            if (abs($amountUsd - $claimedUsd) > max($tolerance, 0.10)) {
                return [
                    'ok' => false,
                    'reason' => 'Amount mismatch: on-chain = $'.number_format($amountUsd, 2, '.', '').
                        ', claimed = $'.number_format($claimedUsd, 2, '.', '').'.',
                ];
            }

            return ['ok' => true, 'amount_usd' => $amountUsd];
        } catch (\Throwable $e) {
            Log::error('USDT transfer verify failed', [
                'error' => $e->getMessage(),
                'tx' => $txHash,
                'purpose' => $purpose,
            ]);

            return ['ok' => false, 'reason' => 'Could not verify transaction. Please try again.'];
        }
    }

    public function resolvedUsdtContract(): string
    {
        $fromBlockchain = strtolower(trim((string) config('blockchain.contracts.usdt', '')));
        if (preg_match('/^0x[a-f0-9]{40}$/', $fromBlockchain)) {
            return $fromBlockchain;
        }

        return strtolower(trim((string) config(
            'wallet.usdt_contract_bep20',
            self::OFFICIAL_USDT_MAINNET,
        )));
    }

    private function assertUsdtPolicy(string $usdtContract, int $chainId): ?string
    {
        if ($chainId === 56) {
            if ($usdtContract !== self::OFFICIAL_USDT_MAINNET) {
                return 'Flash / fake USDT rejected. Mainnet deposits require official Tether USDT (BEP20).';
            }

            return null;
        }

        if ($chainId === 97) {
            if ($usdtContract === self::OFFICIAL_USDT_MAINNET) {
                return 'Mainnet USDT cannot be used on BSC Testnet. Use the project TestnetMockUSDT only.';
            }

            return null;
        }

        return 'Unsupported chain for USDT deposits.';
    }

    /**
     * @param  list<mixed>  $logs
     */
    private function sumOfficialTransfersFromReceipt(
        array $logs,
        string $usdtContract,
        string $fromAddress,
        string $adminAddress,
        int $usdtDecimals,
    ): float {
        $total = 0.0;

        foreach ($logs as $log) {
            if (! is_array($log)) {
                continue;
            }

            $logAddress = strtolower((string) ($log['address'] ?? ''));
            if ($logAddress !== $usdtContract) {
                // Ignore any other token Transfer in the same tx (flash / spam tokens).
                continue;
            }

            $topics = $log['topics'] ?? [];
            if (! is_array($topics) || count($topics) < 3) {
                continue;
            }

            if (strtolower((string) $topics[0]) !== self::TRANSFER_TOPIC0) {
                continue;
            }

            $from = '0x'.substr(strtolower((string) $topics[1]), 24);
            $to = '0x'.substr(strtolower((string) $topics[2]), 24);
            if ($from !== $fromAddress || $to !== $adminAddress) {
                continue;
            }

            $data = \App\Support\Hex::stripPrefix((string) ($log['data'] ?? '0x'));
            if ($data === '' || ! ctype_xdigit($data)) {
                continue;
            }

            $raw = $this->hexToDecimalString($data);
            if ($raw === '0') {
                continue;
            }

            $divisor = bcpow('10', (string) $usdtDecimals, 0);
            $human = function_exists('bcdiv')
                ? (float) bcdiv($raw, $divisor, 8)
                : ((float) $raw) / (10 ** $usdtDecimals);

            if ($human > 0) {
                $total += $human;
            }
        }

        return $total;
    }

    private function hexToDecimalString(string $hex): string
    {
        $hex = ltrim($hex, '0');
        if ($hex === '') {
            return '0';
        }

        return function_exists('gmp_init')
            ? gmp_strval(gmp_init($hex, 16), 10)
            : (string) hexdec($hex);
    }

    /**
     * @param  list<mixed>  $params
     */
    private function rpc(string $method, array $params): mixed
    {
        $rpcUrl = trim((string) config('blockchain.rpc_url', ''));
        if ($rpcUrl === '') {
            $rpcUrl = (int) config('blockchain.chain_id', 56) === 97
                ? 'https://data-seed-prebsc-1-s2.binance.org:8545'
                : 'https://bsc-dataseed.binance.org/';
        }

        $response = Http::timeout(15)->post($rpcUrl, [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => $method,
            'params' => $params,
        ]);

        if (! $response->successful()) {
            // Explorer proxy fallback (when RPC blocked).
            return $this->explorerProxy($method, $params);
        }

        $json = $response->json();
        if (isset($json['error'])) {
            return $this->explorerProxy($method, $params);
        }

        return $json['result'] ?? null;
    }

    /**
     * @param  list<mixed>  $params
     */
    private function explorerProxy(string $method, array $params): mixed
    {
        $apiKey = trim((string) config('wallet.bscscan_api_key', ''));
        $chainId = (int) config('blockchain.chain_id', 56);
        $base = $chainId === 97
            ? 'https://api-testnet.bscscan.com/api'
            : 'https://api.bscscan.com/api';

        $query = [
            'module' => 'proxy',
            'action' => $method,
            'apikey' => $apiKey,
        ];

        if ($method === 'eth_getTransactionReceipt' || $method === 'eth_getTransactionByHash') {
            $query['txhash'] = $params[0] ?? '';
        } elseif ($method === 'eth_getCode') {
            $query['address'] = $params[0] ?? '';
            $query['tag'] = $params[1] ?? 'latest';
        }

        $response = Http::timeout(15)->get($base, $query);
        if (! $response->successful()) {
            throw new \RuntimeException('Explorer proxy HTTP error');
        }

        return $response->json('result');
    }
}
