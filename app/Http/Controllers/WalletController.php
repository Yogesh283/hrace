<?php

namespace App\Http\Controllers;

use App\Services\WalletAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WalletController extends Controller
{
    public function __construct(
        protected WalletAuthService $walletAuth,
    ) {}

    public function nonce(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'address' => ['required', 'string', 'max:66', 'regex:/^0x[a-fA-F0-9]{40}$/'],
        ]);

        $user = $request->user();
        if (trim((string) ($user->wallet_address ?? '')) !== '') {
            return response()->json([
                'error' => __('Your withdrawal address is already set and cannot be changed.'),
            ], 422);
        }

        try {
            $address = $this->walletAuth->normalizeAddress($validated['address']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $payload = $this->walletAuth->issueWalletLinkNonce((int) $user->id, $address);

        return response()->json($payload);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        if (trim((string) ($user->wallet_address ?? '')) !== '') {
            return back()->with('error', __('Your withdrawal address is already set and cannot be changed.'));
        }

        $validated = $request->validate([
            'address' => ['required', 'string', 'max:66', 'regex:/^0x[a-fA-F0-9]{40}$/'],
            'signature' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{130}$/'],
        ]);

        try {
            $address = $this->walletAuth->normalizeAddress($validated['address']);
        } catch (\InvalidArgumentException) {
            throw ValidationException::withMessages([
                'address' => __('Invalid wallet address.'),
            ]);
        }

        $valid = $this->walletAuth->verifyWalletLinkSignature(
            (int) $user->id,
            $address,
            $validated['signature'],
        );

        if (! $valid) {
            throw ValidationException::withMessages([
                'signature' => __('Wallet signature verification failed. Request a new sign-in message and try again.'),
            ]);
        }

        $user->update([
            'wallet_address' => $address,
        ]);
        app(\App\Services\Blockchain\BlockchainWalletIndexerSyncService::class)->syncForUser($user->fresh());

        return back()->with('status', __('Wallet connected.'));
    }

    public function disconnect(Request $request): RedirectResponse
    {
        if (trim((string) ($request->user()->wallet_address ?? '')) !== '') {
            return back()->with('error', __('Your withdrawal address is fixed and cannot be removed.'));
        }

        $request->user()->update(['wallet_address' => null]);

        return back()->with('status', __('Wallet disconnected.'));
    }
}
