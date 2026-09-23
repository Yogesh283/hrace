<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Services\Income\LedgerWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DepositController extends Controller
{
    // ── Web3 on-chain deposit — verify tx hash then credit ─────────────────
    public function verifyOnChain(Request $request, LedgerWriter $ledger): JsonResponse
    {
        $validated = $request->validate([
            'tx_hash'    => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{64}$/'],
            'amount_usd' => ['required', 'numeric', 'min:1', 'max:999999.99'],
        ]);

        $user    = $request->user();
        $txHash  = strtolower($validated['tx_hash']);
        $claimed = (float) $validated['amount_usd'];

        $walletAddress = trim((string) ($user->wallet_address ?? ''));
        if ($walletAddress === '') {
            return response()->json(['error' => 'Connect your crypto wallet before depositing.'], 422);
        }

        // ── Duplicate check ────────────────────────────────────────────────
        $alreadyUsed = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->whereJsonContains('meta->tx_hash', $txHash)
            ->exists();

        if ($alreadyUsed) {
            return response()->json(['error' => 'This transaction has already been credited.'], 409);
        }

        // ── Verify on BSCScan ──────────────────────────────────────────────
        $verification = $this->verifyBscTransaction($txHash, $claimed, $walletAddress);

        if (! $verification['ok']) {
            Log::warning('Web3 deposit verification failed', [
                'user_id' => $user->id,
                'tx_hash' => $txHash,
                'reason'  => $verification['reason'],
            ]);

            return response()->json(['error' => $verification['reason']], 422);
        }

        $verifiedAmount = number_format($verification['amount_usd'], 2, '.', '');

        // ── Credit ledger ──────────────────────────────────────────────────
        try {
            DB::transaction(function () use ($user, $verifiedAmount, $txHash, $ledger) {
                $user->loadMissing('userWallet');
                $ledger->record(
                    $user,
                    LedgerEntry::TYPE_WALLET_DEPOSIT,
                    $verifiedAmount,
                    'deposit',
                    null,
                    [
                        'tx_hash'  => $txHash,
                        'method'   => 'web3_usdt',
                        'network'  => SiteSetting::treasuryNetworkLabel(),
                    ],
                );
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['error' => 'Credit failed. Please contact support.'], 500);
        }

        return response()->json([
            'success'    => true,
            'amount_usd' => $verifiedAmount,
            'message'    => "Deposit of \${$verifiedAmount} USDT credited to your wallet.",
        ]);
    }

    // ── BSCScan transaction verifier ───────────────────────────────────────
    private function verifyBscTransaction(string $txHash, float $claimedUsd, string $fromAddress): array
    {
        $adminAddress = strtolower(SiteSetting::treasuryAddress());
        $apiKey       = (string) config('wallet.bscscan_api_key', '');
        $usdtContract = strtolower((string) config('wallet.usdt_contract_bep20', '0x55d398326f99059ff775485246999027b3197955'));
        $usdtSymbol   = strtoupper((string) config('wallet.usdt_symbol', 'USDT'));
        $usdtDecimals = (int) config('wallet.usdt_decimals', 18);
        $minConfirms  = max(1, (int) config('wallet.deposit_min_confirmations', 12));

        if (trim($apiKey) === '') {
            return ['ok' => false, 'reason' => 'Deposit verification is not configured. Contact support.'];
        }

        if ($adminAddress === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $adminAddress)) {
            return ['ok' => false, 'reason' => 'Company deposit address is not configured.'];
        }

        try {
            $receiptRes = Http::timeout(10)->get('https://api.bscscan.com/api', [
                'module' => 'proxy',
                'action' => 'eth_getTransactionReceipt',
                'txhash' => $txHash,
                'apikey' => $apiKey,
            ]);

            $receipt = $receiptRes->json('result');

            if (empty($receipt)) {
                return ['ok' => false, 'reason' => 'Transaction not found on chain. Please wait for confirmation.'];
            }

            if (($receipt['status'] ?? '') !== '0x1') {
                return ['ok' => false, 'reason' => 'Transaction failed on chain.'];
            }

            $txTo = strtolower($receipt['to'] ?? '');
            if ($txTo !== $usdtContract) {
                return ['ok' => false, 'reason' => 'Only official USDT (BEP20) transfers are accepted.'];
            }

            $txRes = Http::timeout(10)->get('https://api.bscscan.com/api', [
                'module' => 'proxy',
                'action' => 'eth_getTransactionByHash',
                'txhash' => $txHash,
                'apikey' => $apiKey,
            ]);

            $txFrom = strtolower($txRes->json('result.from') ?? '');
            if ($txFrom === '' || $txFrom !== strtolower($fromAddress)) {
                return ['ok' => false, 'reason' => 'Transaction sender does not match your connected wallet.'];
            }

            $txBlockHex = $receipt['blockNumber'] ?? null;
            if (! is_string($txBlockHex) || $txBlockHex === '') {
                return ['ok' => false, 'reason' => 'Could not read transaction block.'];
            }

            $currentBlockRes = Http::timeout(10)->get('https://api.bscscan.com/api', [
                'module' => 'proxy',
                'action' => 'eth_blockNumber',
                'apikey' => $apiKey,
            ]);

            $currentBlockHex = $currentBlockRes->json('result');
            if (! is_string($currentBlockHex) || $currentBlockHex === '') {
                return ['ok' => false, 'reason' => 'Could not verify block confirmations.'];
            }

            $confirmations = hexdec($currentBlockHex) - hexdec($txBlockHex) + 1;
            if ($confirmations < $minConfirms) {
                return [
                    'ok'     => false,
                    'reason' => "Waiting for confirmations ({$confirmations}/{$minConfirms}). Try again shortly.",
                ];
            }

            $tokenRes = Http::timeout(10)->get('https://api.bscscan.com/api', [
                'module'          => 'account',
                'action'          => 'tokentx',
                'contractaddress' => $usdtContract,
                'txhash'          => $txHash,
                'apikey'          => $apiKey,
            ]);

            $transfers = $tokenRes->json('result');

            if (! is_array($transfers) || count($transfers) === 0) {
                return ['ok' => false, 'reason' => 'No official USDT transfer found in this transaction.'];
            }

            $amountUsd = 0.0;
            $foundToAdmin = false;

            foreach ($transfers as $transfer) {
                $transferContract = strtolower($transfer['contractAddress'] ?? '');
                if ($transferContract !== $usdtContract) {
                    continue;
                }

                $symbol = strtoupper(trim((string) ($transfer['tokenSymbol'] ?? '')));
                if ($symbol !== $usdtSymbol) {
                    return ['ok' => false, 'reason' => 'Fake or unsupported token — only official USDT is accepted.'];
                }

                $decimals = (int) ($transfer['tokenDecimal'] ?? 0);
                if ($decimals !== $usdtDecimals) {
                    return ['ok' => false, 'reason' => 'Invalid USDT token — only official BEP20 USDT is accepted.'];
                }

                $to   = strtolower($transfer['to'] ?? '');
                $from = strtolower($transfer['from'] ?? '');

                if ($to !== $adminAddress || $from !== strtolower($fromAddress)) {
                    continue;
                }

                $rawAmount = (float) ($transfer['value'] ?? 0);
                $amountUsd += $rawAmount / (10 ** $decimals);
                $foundToAdmin = true;
            }

            if (! $foundToAdmin || $amountUsd <= 0) {
                return ['ok' => false, 'reason' => 'No official USDT transfer from your wallet to the company address was found.'];
            }

            $tolerance = $claimedUsd * 0.01;
            if (abs($amountUsd - $claimedUsd) > max($tolerance, 0.10)) {
                return [
                    'ok'     => false,
                    'reason' => "Amount mismatch: on-chain = \${$amountUsd}, claimed = \${$claimedUsd}.",
                ];
            }

            return ['ok' => true, 'amount_usd' => $amountUsd];
        } catch (\Throwable $e) {
            Log::error('BSCScan API error', ['error' => $e->getMessage(), 'tx' => $txHash]);

            return ['ok' => false, 'reason' => 'Could not verify transaction. Please try again.'];
        }
    }
}
