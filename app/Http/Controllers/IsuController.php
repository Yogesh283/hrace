<?php

namespace App\Http\Controllers;

use App\Models\IcoPurchase;
use App\Services\Blockchain\BlockchainContractPayload;
use App\Services\Blockchain\BlockchainWalletIndexerSyncService;
use App\Services\Blockchain\CommunityEngineStakeReadService;
use App\Support\OnChainReferrer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

/**
 * /ico — on-chain RaceICO mint-to-user purchase UI.
 * Blockchain is source of truth; Laravel only indexes history.
 */
class IsuController extends Controller
{
    public function index(
        Request $request,
        BlockchainWalletIndexerSyncService $walletSync,
        CommunityEngineStakeReadService $stakeRead,
    ): Response {
        $user = $request->user();
        $web3Ico = BlockchainContractPayload::icoPagePayload();
        $web3Engine = BlockchainContractPayload::enginePayload();
        $lockTiers = array_values(array_filter(
            $web3Ico['stake_plans'] ?? [],
            static fn (array $plan): bool => (int) ($plan['days'] ?? 0) > 0,
        ));

        $indexed = [];
        $indexedEngineStakes = [];

        if ($user && $user->wallet_address && Schema::hasTable('ico_purchases')) {
            $walletSync->syncForUser($user);
            $wallet = strtolower((string) $user->wallet_address);

            $stakesByPurchase = [];
            if (Schema::hasTable('blockchain_engine_stakes')) {
                $indexedEngineStakes = $stakeRead->stakesForUser($user, enrichLiveState: false);
                foreach ($indexedEngineStakes as $stake) {
                    if ($stake['ico_purchase_id'] !== null) {
                        $stakesByPurchase[(int) $stake['ico_purchase_id']] = $stake;
                    }
                }
            }

            $indexed = IcoPurchase::query()
                ->where(function ($inner) use ($user, $wallet) {
                    $inner->where('user_id', $user->id)
                        ->orWhere('wallet_address', $wallet);
                })
                ->orderByDesc('id')
                ->limit(50)
                ->get()
                ->map(static function (IcoPurchase $row) use ($stakesByPurchase) {
                    $stake = $stakesByPurchase[(int) $row->purchase_id] ?? null;

                    return [
                        'purchase_id' => (int) $row->purchase_id,
                        'phase' => (int) $row->phase,
                        'usdt_amount' => (string) $row->usdt_amount,
                        'race_amount' => (string) $row->race_amount,
                        'price' => (string) $row->price,
                        'tx_hash' => (string) $row->tx_hash,
                        'block_number' => $row->block_number,
                        'status' => (string) $row->status,
                        'wallet_address' => (string) $row->wallet_address,
                        'lock_days' => $stake['lock_days'] ?? null,
                        'plan_label' => $stake['plan_label'] ?? null,
                        'stake_index' => $stake['stake_index'] ?? null,
                        'created_at' => optional($row->created_at)?->toIso8601String(),
                    ];
                })
                ->values()
                ->all();
        }

        return Inertia::render('Isu', [
            'web3Ico' => $web3Ico,
            'web3Engine' => $web3Engine,
            'lock_tiers' => $lockTiers,
            'indexed_purchases' => $indexed,
            'indexed_engine_stakes' => $indexedEngineStakes,
            'on_chain_sponsor_wallet' => $user ? OnChainReferrer::sponsorWalletFor($user) : null,
        ]);
    }
}
