<?php

namespace App\Http\Controllers;

use App\Models\RaceCoinSwap;
use App\Models\SiteSetting;
use App\Services\Blockchain\UsdtTransferVerifier;
use App\Services\Income\RaceCoinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class SwapController extends Controller
{
    public function index(Request $request, RaceCoinService $raceCoin): Response
    {
        $user = $request->user();

        $swapEntries = RaceCoinSwap::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(50)
            ->get([
                'id',
                'swap_type',
                'usdt_amount',
                'coins_amount',
                'balance_after_coins',
                'tx_hash',
                'meta',
                'created_at',
            ])
            ->map(static fn ($row) => [
                'id' => $row->id,
                'swap_type' => $row->swap_type,
                'usdt_amount' => $row->usdt_amount,
                'coins_amount' => $row->coins_amount,
                'balance_after_coins' => $row->balance_after_coins,
                'tx_hash' => $row->tx_hash,
                'created_at' => $row->created_at?->toIso8601String(),
                'detail' => $row->swap_type === RaceCoinSwap::TYPE_ACTIVATION_DEBIT
                    ? 'ID activation'
                    : 'USDT → Race Coin',
            ]);

        return Inertia::render('Swap', [
            'depositAddress' => SiteSetting::depositAddressPayload(),
            'raceCoin' => [
                'price_usd' => number_format($raceCoin->priceUsd(), 2, '.', ''),
                'min_swap_usd' => number_format((float) config('race_coin.min_swap_usd', 1), 2, '.', ''),
                'balance' => $raceCoin->currentBalance($user),
                'id_activation_coins' => $raceCoin->idActivationCoinsRequired(),
                'id_activation_usd' => number_format((float) config('race_coin.id_activation_usd', 50), 2, '.', ''),
                'id_active' => $user->id_activated_at !== null,
            ],
            'swap_entries' => $swapEntries,
        ]);
    }

    public function verifyOnChain(Request $request, RaceCoinService $raceCoin, UsdtTransferVerifier $verifier): JsonResponse
    {
        $minSwap = (float) config('race_coin.min_swap_usd', 1);

        $validated = $request->validate([
            'tx_hash' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{64}$/'],
            'amount_usd' => ['required', 'numeric', 'min:'.$minSwap, 'max:999999.99'],
        ]);

        $user = $request->user();
        $txHash = strtolower($validated['tx_hash']);
        $claimed = (float) $validated['amount_usd'];

        $walletAddress = trim((string) ($user->wallet_address ?? ''));
        if ($walletAddress === '') {
            return response()->json(['error' => 'Connect your crypto wallet before swapping.'], 422);
        }

        $alreadyUsed = RaceCoinSwap::query()
            ->where('swap_type', RaceCoinSwap::TYPE_SWAP_CREDIT)
            ->where('tx_hash', $txHash)
            ->exists();

        if ($alreadyUsed) {
            return response()->json(['error' => 'This transaction has already been credited.'], 409);
        }

        $verification = $verifier->verifyTransferToTreasury($txHash, $claimed, $walletAddress, 'swap');

        if (! $verification['ok']) {
            Log::warning('Race Coin swap verification failed', [
                'user_id' => $user->id,
                'tx_hash' => $txHash,
                'reason' => $verification['reason'],
            ]);

            return response()->json(['error' => $verification['reason']], 422);
        }

        $verifiedAmount = $verification['amount_usd'];
        $coinsCredited = $raceCoin->coinsForUsdt($verifiedAmount);

        try {
            DB::transaction(function () use ($user, $verifiedAmount, $txHash, $raceCoin) {
                $raceCoin->creditFromSwap($user, $verifiedAmount, $txHash);
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['error' => 'Swap credit failed. Please contact support.'], 500);
        }

        return response()->json([
            'success' => true,
            'amount_usd' => number_format($verifiedAmount, 2, '.', ''),
            'coins_credited' => $coinsCredited,
            'message' => "Swap complete — {$coinsCredited} Race Coin credited.",
        ]);
    }

    public function activateId(Request $request, RaceCoinService $raceCoin): RedirectResponse
    {
        $user = $request->user();

        try {
            $raceCoin->activateIdWithCoins($user);
        } catch (\InvalidArgumentException $e) {
            return back()->withErrors(['race_coin' => $e->getMessage()]);
        }

        return back()->with('status', __('Your member ID is now active. Race Coin has been deducted from your balance.'));
    }
}
