<?php

namespace App\Console\Commands;

use App\Models\BlockchainEngineStake;
use App\Models\IcoPurchase;
use App\Support\BlockchainRpc;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

/**
 * Live stake list + why instant community referral did / did not pay (same tx).
 */
class ExplainStakeReferralsCommand extends Command
{
    protected $signature = 'blockchain:explain-stake-referrals';

    protected $description = 'List qualifying stakes and reason if CommunityReferralPaid missing (on-chain, same tx).';

    private const REFERRAL_TOPIC = '0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966';

    private const SELECTOR_REFERRER = 'd21cacdf';

    private const SELECTOR_ACTIVE = '2d3e946c';

    public function handle(): int
    {
        $engine = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));
        $this->info('engine='.$engine);
        $this->info('rpc='.BlockchainRpc::primaryRpcUrl());
        $this->newLine();

        $rows = $this->collectStakes();
        if ($rows === []) {
            $this->warn('No qualifying stakes found in ico_purchases / blockchain_engine_stakes.');

            return self::SUCCESS;
        }

        foreach ($rows as $row) {
            $this->line(json_encode($row, JSON_UNESCAPED_SLASHES));
        }

        $missed = array_filter($rows, static fn ($r) => ($r['referral_paid'] ?? false) === false);
        $this->newLine();
        $this->info('total_stakes='.count($rows).' missed_referral='.count($missed));

        return self::SUCCESS;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collectStakes(): array
    {
        $out = [];

        if (Schema::hasTable('ico_purchases')) {
            IcoPurchase::query()->orderBy('id')->each(function (IcoPurchase $p) use (&$out) {
                $usdt = (float) $p->usdt_amount;
                if ($usdt < 50) {
                    return;
                }
                $out[] = $this->explainRow(
                    (int) $p->purchase_id,
                    $p->user_id,
                    (string) $p->wallet_address,
                    $usdt,
                    strtolower((string) $p->tx_hash),
                    null,
                );
            });
        }

        if ($out === [] && Schema::hasTable('blockchain_engine_stakes')) {
            BlockchainEngineStake::query()->where('principal_usdt', '>=', 50)->orderBy('id')->each(function ($s) use (&$out) {
                $out[] = $this->explainRow(
                    $s->ico_purchase_id,
                    $s->user_id,
                    (string) $s->wallet_address,
                    (float) $s->principal_usdt,
                    strtolower((string) $s->tx_hash),
                    (int) $s->block_number,
                );
            });
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function explainRow(
        mixed $purchaseId,
        mixed $userId,
        string $wallet,
        float $usdt,
        string $tx,
        ?int $blockHint,
    ): array {
        $engine = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));
        $receipt = $tx !== '' ? $this->receipt($tx) : null;
        $block = $blockHint ?? (is_array($receipt) ? hexdec((string) ($receipt['blockNumber'] ?? '0x0')) : 0);
        $refLogs = $this->countReferralLogs($receipt);
        $paid = $refLogs > 0;

        $walletLower = strtolower($wallet);
        $zero = '0x0000000000000000000000000000000000000000';

        $referrerAtBlock = $walletLower !== '' && $block > 0
            ? $this->callEngineView($engine, self::SELECTOR_REFERRER, $walletLower, $block)
            : null;
        $referrerNow = $walletLower !== ''
            ? $this->callEngineView($engine, self::SELECTOR_REFERRER, $walletLower, 0)
            : null;

        $referrerForReason = $referrerAtBlock ?? $referrerNow;
        if ($referrerForReason === $zero) {
            $referrerForReason = null;
        }

        $sponsorActiveAtBlock = $referrerAtBlock && $referrerAtBlock !== $zero
            ? $this->callEngineViewBool($engine, self::SELECTOR_ACTIVE, $referrerAtBlock, $block)
            : false;
        $sponsorActiveNow = $referrerNow && $referrerNow !== $zero
            ? $this->callEngineViewBool($engine, self::SELECTOR_ACTIVE, $referrerNow, 0)
            : false;

        $reason = 'OK_SAME_TX_REFERRAL_PAID';
        $fix = null;
        if (! $paid) {
            if ($referrerForReason === null) {
                $reason = 'NO_ON_CHAIN_SPONSOR';
                $fix = 'Call Engine.register(sponsor) before stake — otherwise the ICO tx registers with a zero referrer; the UI now binds and activates the sponsor first.';
            } elseif (! $sponsorActiveAtBlock && ($sponsorActiveNow || $referrerAtBlock === null)) {
                $reason = 'SPONSOR_NOT_ACTIVE_AT_STAKE';
                $fix = 'Sponsor must complete $50+ Buy & Stake (on-chain active) before the downline; level income is paid in that downline stake tx.';
            } elseif (! $sponsorActiveAtBlock) {
                $reason = 'SPONSOR_NOT_ACTIVE_AT_STAKE';
                $fix = 'Sponsor is still inactive — complete the sponsor $50+ stake first.';
            } else {
                $reason = 'REFERRAL_NOT_EMITTED_OTHER';
                $fix = 'Check receipt / oracle / vault; send the tx hash to support.';
            }
        }

        return [
            'ico_purchase_id' => $purchaseId,
            'user_id' => $userId,
            'wallet' => $walletLower,
            'principal_usdt' => $usdt,
            'tx_hash' => $tx,
            'block' => $block,
            'referral_events_in_tx' => $refLogs,
            'referral_paid' => $paid,
            'referrer_at_stake_block' => $referrerAtBlock,
            'referrer_now' => $referrerNow,
            'sponsor_active_at_stake_block' => $sponsorActiveAtBlock,
            'sponsor_active_now' => $sponsorActiveNow,
            'reason_code' => $reason,
            'fix' => $fix,
        ];
    }

    private function receipt(string $tx): ?array
    {
        $response = Http::timeout(25)->post(BlockchainRpc::primaryRpcUrl(), [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'eth_getTransactionReceipt',
            'params' => [$tx],
        ]);

        $result = $response->json('result');

        return is_array($result) ? $result : null;
    }

    private function countReferralLogs(?array $receipt): int
    {
        if (! is_array($receipt)) {
            return -1;
        }
        $topic = strtolower(self::REFERRAL_TOPIC);
        $n = 0;
        foreach ($receipt['logs'] ?? [] as $log) {
            if (strtolower((string) ($log['topics'][0] ?? '')) === $topic) {
                $n++;
            }
        }

        return $n;
    }

    private function callEngineView(string $engine, string $selector, string $wallet, int $block): ?string
    {
        $data = '0x'.$selector.str_pad(substr(strtolower($wallet), 2), 64, '0', STR_PAD_LEFT);
        $blockTag = $block > 0 ? '0x'.dechex($block) : 'latest';

        $response = Http::timeout(25)->post(BlockchainRpc::primaryRpcUrl(), [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'eth_call',
            'params' => [
                ['to' => $engine, 'data' => $data],
                $blockTag,
            ],
        ]);

        $result = $response->json('result');
        if ($response->json('error') !== null) {
            return null;
        }
        if (! is_string($result) || strlen($result) < 66) {
            return null;
        }

        return '0x'.strtolower(substr($result, -40));
    }

    private function callEngineViewBool(string $engine, string $selector, string $wallet, int $block): bool
    {
        $data = '0x'.$selector.str_pad(substr(strtolower($wallet), 2), 64, '0', STR_PAD_LEFT);
        $blockTag = $block > 0 ? '0x'.dechex($block) : 'latest';

        $response = Http::timeout(25)->post(BlockchainRpc::primaryRpcUrl(), [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'eth_call',
            'params' => [
                ['to' => $engine, 'data' => $data],
                $blockTag,
            ],
        ]);

        $result = $response->json('result');

        return is_string($result) && $result !== '0x0000000000000000000000000000000000000000';
    }
}
