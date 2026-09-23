<?php

namespace App\Http\Controllers;

use App\Models\BlockchainParticipation;
use App\Services\Blockchain\ParticipationOnChainSyncService;
use App\Support\RewardPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ParticipationOnChainController extends Controller
{
  /**
     * @return array<string, mixed>
     */
    public static function contractPayload(): array
    {
        return \App\Services\Blockchain\BlockchainContractPayload::enginePayload();
    }

    public function verifyOnChain(Request $request, ParticipationOnChainSyncService $sync): JsonResponse
    {
        if (! \App\Support\LegacyParticipationGuard::applicationEnabled()) {
            $engine = trim((string) config('blockchain.contracts.community_engine', ''));
            if ($engine === '') {
                return response()->json([
                    'error' => __('On-chain staking uses RaceCommunityEngine. Configure RACE_COMMUNITY_ENGINE_CONTRACT.'),
                ], 422);
            }
        }

        $validated = $request->validate([
            'tx_hash' => ['required', 'string', 'regex:/^0x[a-fA-F0-9]{64}$/'],
        ]);

        $result = $sync->syncFromTransaction($request->user(), $validated['tx_hash']);

        if (! $result['ok']) {
            return response()->json(['error' => $result['reason'] ?? __('Sync failed.')], 422);
        }

        /** @var BlockchainParticipation $record */
        $record = $result['participation'];

        return response()->json([
            'success' => true,
            'message' => __('On-chain staking indexed. Daily RACE rewards are paid by the smart contract.'),
            'participation' => [
                'tx_hash' => $record->tx_hash,
                'stake_index' => $record->stake_index,
                'principal_usdt' => $record->principal_usdt,
            ],
        ]);
    }
}
