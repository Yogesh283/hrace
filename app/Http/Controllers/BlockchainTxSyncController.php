<?php

namespace App\Http\Controllers;

use App\Services\Blockchain\BlockchainEventIngestService;
use App\Services\Blockchain\ParticipationOnChainSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Instant DB sync for a confirmed on-chain tx (ICO / stake / claim / compound / withdraw).
 * Complements cron blockchain:index-events — does not mint or calculate rewards.
 */
class BlockchainTxSyncController extends Controller
{
    public function sync(
        Request $request,
        BlockchainEventIngestService $ingest,
        ParticipationOnChainSyncService $participationSync,
    ): JsonResponse {
        $validated = $request->validate([
            'tx_hash' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{64}$/'],
        ]);

        $txHash = strtolower($validated['tx_hash']);
        $result = $ingest->ingestFromTxHash($txHash);

        if (! $result['ok']) {
            return response()->json([
                'error' => $result['reason'] ?? __('Sync failed.'),
                'events_indexed' => 0,
            ], 422);
        }

        $participation = null;
        $participationError = null;
        try {
            $sync = $participationSync->syncFromTransaction($request->user(), $txHash);
            if ($sync['ok'] ?? false) {
                $participation = [
                    'tx_hash' => $sync['participation']->tx_hash ?? $txHash,
                    'stake_index' => $sync['participation']->stake_index ?? null,
                    'principal_usdt' => $sync['participation']->principal_usdt ?? null,
                ];
            } else {
                $participationError = $sync['reason'] ?? null;
            }
        } catch (\Throwable $e) {
            Log::info('blockchain sync-tx participation side-effect skipped', [
                'tx' => $txHash,
                'error' => $e->getMessage(),
            ]);
            $participationError = $e->getMessage();
        }

        return response()->json([
            'success' => true,
            'message' => __('Transaction indexed into database.'),
            'tx_hash' => $txHash,
            'events_indexed' => $result['events_indexed'],
            'event_names' => $result['event_names'],
            'participation' => $participation,
            'participation_note' => $participationError,
        ]);
    }
}
