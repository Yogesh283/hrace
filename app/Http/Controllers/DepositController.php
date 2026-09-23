<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Models\SiteSetting;
use App\Services\Blockchain\UsdtTransferVerifier;
use App\Services\Income\LedgerWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DepositController extends Controller
{
    public function verifyOnChain(Request $request, LedgerWriter $ledger, UsdtTransferVerifier $verifier): JsonResponse
    {
        $validated = $request->validate([
            'tx_hash' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{64}$/'],
            'amount_usd' => ['required', 'numeric', 'min:1', 'max:999999.99'],
        ]);

        $user = $request->user();
        $txHash = strtolower($validated['tx_hash']);
        $claimed = (float) $validated['amount_usd'];

        $walletAddress = trim((string) ($user->wallet_address ?? ''));
        if ($walletAddress === '') {
            return response()->json(['error' => 'Connect your crypto wallet before depositing.'], 422);
        }

        $alreadyUsed = LedgerEntry::query()
            ->where('entry_type', LedgerEntry::TYPE_WALLET_DEPOSIT)
            ->whereJsonContains('meta->tx_hash', $txHash)
            ->exists();

        if ($alreadyUsed) {
            return response()->json(['error' => 'This transaction has already been credited.'], 409);
        }

        $verification = $verifier->verifyTransferToTreasury($txHash, $claimed, $walletAddress, 'deposit');

        if (! $verification['ok']) {
            Log::warning('Web3 deposit verification failed', [
                'user_id' => $user->id,
                'tx_hash' => $txHash,
                'reason' => $verification['reason'],
            ]);

            return response()->json(['error' => $verification['reason']], 422);
        }

        $verifiedAmount = number_format($verification['amount_usd'], 2, '.', '');

        try {
            DB::transaction(function () use ($user, $verifiedAmount, $txHash, $ledger, $verifier) {
                $user->loadMissing('userWallet');
                $ledger->record(
                    $user,
                    LedgerEntry::TYPE_WALLET_DEPOSIT,
                    $verifiedAmount,
                    'deposit',
                    null,
                    [
                        'tx_hash' => $txHash,
                        'method' => 'web3_usdt',
                        'network' => SiteSetting::treasuryNetworkLabel(),
                        'usdt_contract' => $verifier->resolvedUsdtContract(),
                        'anti_flash' => true,
                    ],
                );
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['error' => 'Credit failed. Please contact support.'], 500);
        }

        return response()->json([
            'success' => true,
            'amount_usd' => $verifiedAmount,
            'message' => "Deposit of \${$verifiedAmount} USDT credited to your wallet.",
        ]);
    }
}
