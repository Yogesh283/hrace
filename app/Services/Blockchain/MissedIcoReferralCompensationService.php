<?php

namespace App\Services\Blockchain;

use App\Models\IcoPurchase;
use App\Models\User;
use App\Services\Income\ReferralTree;
use App\Support\OnChainReferrer;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\Http;

/**
 * Plans L1–L10 community referral that should have been paid on ICO stake tx but was not (read-only audit + payout plan).
 */
class MissedIcoReferralCompensationService
{
    private const COMMUNITY_REFERRAL_TOPIC = '0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966';

    public function __construct(
        private readonly ReferralTree $tree,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function planPendingCompensations(): array
    {
        $rows = [];
        IcoPurchase::query()
            ->where('usdt_amount', '>=', 50)
            ->orderBy('id')
            ->each(function (IcoPurchase $purchase) use (&$rows) {
                $tx = strtolower(trim((string) $purchase->tx_hash));
                if ($tx === '') {
                    return;
                }
                if ($this->referralLogCountInTx($tx) > 0) {
                    return;
                }

                $buyer = $purchase->user;
                if ($buyer === null) {
                    return;
                }

                $principal = number_format((float) $purchase->usdt_amount, 2, '.', '');
                $ancestor = $buyer->referred_by ? User::query()->find($buyer->referred_by) : null;
                $depth = 1;

                while ($ancestor && $depth <= 10) {
                    $pct = RewardPlan::communityReferralPercentForLevel($depth);
                    if ($pct !== null && $pct > 0 && $this->tree->qualifiesForParticipationLevelPayout($ancestor, $depth)) {
                        $rate = bcdiv((string) $pct, '100', 6);
                        $amountUsd = bcmul($principal, $rate, 2);
                        if (bccomp($amountUsd, '0', 2) > 0) {
                            $wallet = strtolower(trim((string) ($ancestor->wallet_address ?? '')));
                            if (preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
                                $rows[] = [
                                    'ico_purchase_id' => (int) $purchase->purchase_id,
                                    'stake_tx_hash' => $tx,
                                    'buyer_user_id' => (int) $buyer->id,
                                    'buyer_wallet' => strtolower((string) $purchase->wallet_address),
                                    'sponsor_user_id' => (int) $ancestor->id,
                                    'sponsor_wallet' => $wallet,
                                    'level' => $depth,
                                    'percent' => $pct,
                                    'amount_usd' => $amountUsd,
                                    'amount_race' => $amountUsd,
                                    'idempotency_key' => 'ico_ref_comp:p'.(int) $purchase->purchase_id.':L'.$depth.':u'.(int) $ancestor->id,
                                ];
                            }
                        }
                    }

                    $ancestor = $ancestor->referred_by ? User::query()->find($ancestor->referred_by) : null;
                    $depth++;
                }
            });

        return $this->aggregateBySponsor($rows);
    }

    /**
     * @param  list<array<string, mixed>>  $lineItems
     * @return list<array<string, mixed>>
     */
    private function aggregateBySponsor(array $lineItems): array
    {
        $byWallet = [];
        foreach ($lineItems as $row) {
            $w = $row['sponsor_wallet'];
            if (! isset($byWallet[$w])) {
                $byWallet[$w] = [
                    'sponsor_wallet' => $w,
                    'sponsor_user_id' => $row['sponsor_user_id'],
                    'total_race' => '0.00',
                    'line_items' => [],
                ];
            }
            $byWallet[$w]['line_items'][] = $row;
            $byWallet[$w]['total_race'] = bcadd($byWallet[$w]['total_race'], $row['amount_race'], 2);
        }

        return array_values($byWallet);
    }

    public function referralLogCountInTx(string $txHash): int
    {
        $receipt = $this->ethGetTransactionReceipt($txHash);
        if (! is_array($receipt)) {
            return -1;
        }
        $topic = strtolower(self::COMMUNITY_REFERRAL_TOPIC);
        $n = 0;
        foreach ($receipt['logs'] ?? [] as $log) {
            if (! is_array($log)) {
                continue;
            }
            if (strtolower((string) ($log['topics'][0] ?? '')) === $topic) {
                $n++;
            }
        }

        return $n;
    }

    private function ethGetTransactionReceipt(string $txHash): ?array
    {
        $url = \App\Support\BlockchainRpc::primaryRpcUrl();
        $response = Http::timeout(25)->post($url, [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'eth_getTransactionReceipt',
            'params' => [$txHash],
        ]);

        if (! $response->successful()) {
            return null;
        }

        $result = $response->json('result');

        return is_array($result) ? $result : null;
    }

    public function laravelSponsorForPurchase(IcoPurchase $purchase): ?string
    {
        $user = $purchase->user;

        return $user ? OnChainReferrer::sponsorWalletFor($user) : null;
    }
}
