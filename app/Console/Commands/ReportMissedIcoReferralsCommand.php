<?php

namespace App\Console\Commands;

use App\Models\IcoPurchase;
use App\Support\OnChainReferrer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Lists qualifying ICO stakes where on-chain CommunityReferralPaid did not fire (ops / support).
 */
class ReportMissedIcoReferralsCommand extends Command
{
    protected $signature = 'blockchain:report-missed-ico-referrals';

    protected $description = 'Report $50+ ICO stakes with no CommunityReferralPaid in the same tx (level income missed on-chain).';

    private const COMMUNITY_REFERRAL_TOPIC = '0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966';

    private const ICO_STAKE_TOPIC = '0x3bbaced029028afbe3622c5c505c56f82a87ba3bfd76b003656a0147f83db5ee';

    public function handle(): int
    {
        $missed = 0;
        IcoPurchase::query()
            ->where('usdt_amount', '>=', 50)
            ->orderBy('id')
            ->each(function (IcoPurchase $p) use (&$missed) {
                $tx = strtolower(trim((string) $p->tx_hash));
                if ($tx === '') {
                    return;
                }
                $receipt = $this->ethGetTransactionReceipt($tx);
                if ($receipt === null) {
                    $this->line(json_encode([
                        'purchase_id' => $p->purchase_id,
                        'user_id' => $p->user_id,
                        'tx' => $tx,
                        'status' => 'RECEIPT_UNAVAILABLE',
                    ], JSON_UNESCAPED_SLASHES));

                    return;
                }
                $refs = $this->countTopic($receipt, self::COMMUNITY_REFERRAL_TOPIC);
                $stakes = $this->countTopic($receipt, self::ICO_STAKE_TOPIC);
                if ($stakes <= 0) {
                    return;
                }
                if ($refs > 0) {
                    return;
                }
                $missed++;
                $user = $p->user;
                $this->line(json_encode([
                    'purchase_id' => $p->purchase_id,
                    'user_id' => $p->user_id,
                    'wallet' => $p->wallet_address,
                    'laravel_sponsor_wallet' => $user ? OnChainReferrer::sponsorWalletFor($user) : null,
                    'usdt' => $p->usdt_amount,
                    'tx' => $tx,
                    'status' => 'NO_ON_CHAIN_LEVEL_INCOME',
                    'hint' => 'Instant level income is same-tx only. Fix: fresh wallet with sponsor registered before stake, or multisig RACE to upline (no contract replay).',
                ], JSON_UNESCAPED_SLASHES));
            });

        $this->info("Missed on-chain level income cases (qualifying stake, zero referral logs): {$missed}");

        return self::SUCCESS;
    }

    private function rpcUrl(): string
    {
        $urls = config('blockchain.rpc_urls', []);
        if ($urls !== []) {
            return (string) $urls[0];
        }

        return (string) config('blockchain.rpc_url', 'https://bsc-testnet.publicnode.com');
    }

    private function ethGetTransactionReceipt(string $txHash): ?array
    {
        $response = Http::timeout(25)->post($this->rpcUrl(), [
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

    /**
     * @param  array<string, mixed>  $receipt
     */
    private function countTopic(array $receipt, string $topic0): int
    {
        $topic0 = strtolower($topic0);
        $n = 0;
        foreach ($receipt['logs'] ?? [] as $log) {
            if (! is_array($log)) {
                continue;
            }
            if (strtolower((string) ($log['topics'][0] ?? '')) === $topic0) {
                $n++;
            }
        }

        return $n;
    }
}
