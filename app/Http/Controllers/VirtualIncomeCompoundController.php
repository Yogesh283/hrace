<?php

namespace App\Http\Controllers;

use App\Services\Income\VirtualIncomeCompoundService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VirtualIncomeCompoundController extends Controller
{
    public function reserve(Request $request, VirtualIncomeCompoundService $compound): JsonResponse
    {
        $validated = $request->validate([
            'amount_usd' => ['required', 'numeric', 'min:0.01', 'max:999999.99'],
            'stake_index' => ['required', 'integer', 'min:0'],
            'idempotency_key' => ['required', 'string', 'min:8', 'max:128'],
        ]);

        $result = $compound->reserve(
            $request->user(),
            (string) $validated['amount_usd'],
            (string) $validated['idempotency_key'],
            (int) $validated['stake_index'],
        );

        return response()->json([
            'success' => true,
            'transaction_id' => $result['transaction_id'],
            'idempotency_key' => $result['idempotency_key'],
            'message' => __('Virtual balance reserved. Complete on-chain compound, then confirm with tx hash.'),
        ]);
    }

    public function confirm(Request $request, VirtualIncomeCompoundService $compound): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => ['required', 'string', 'min:8', 'max:128'],
            'tx_hash' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{64}$/'],
        ]);

        $row = $compound->confirmOnChain(
            $request->user(),
            (string) $validated['idempotency_key'],
            (string) $validated['tx_hash'],
        );

        return response()->json([
            'success' => true,
            'transaction_id' => $row->id,
            'tx_hash' => $row->metadata['tx_hash'] ?? null,
        ]);
    }
}
