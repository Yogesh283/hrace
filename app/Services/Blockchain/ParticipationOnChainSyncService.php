<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainParticipation;
use App\Models\Investment;
use App\Models\User;
use App\Services\Income\IncomeDispatcher;
use App\Services\Income\InvestmentRecorder;
use App\Services\Member\MemberActivationService;
use App\Support\RewardPlan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Index on-chain ParticipationPurchased events — no reward calculation.
 * Triggers off-chain community referral ledger only (L1–L10).
 */
class ParticipationOnChainSyncService
{
    public function __construct(
        protected MemberActivationService $activation,
        protected IncomeDispatcher $dispatcher,
    ) {}

    /**
     * @return array{ok: bool, reason?: string, participation?: BlockchainParticipation}
     */
    public function syncFromTransaction(User $user, string $txHash): array
    {
        if (! config('participation_contract.on_chain.enabled') && ! \App\Support\BlockchainMode::blockchainOnly() && ! \App\Support\BlockchainMode::onChainEnabled()) {
            return ['ok' => false, 'reason' => __('On-chain staking is not enabled.')];
        }

        $contract = strtolower(trim((string) config('blockchain.contracts.community_engine', '')));
        if ($contract === '' && \App\Support\LegacyParticipationGuard::applicationEnabled()) {
            $contract = strtolower(trim((string) config('participation_contract.on_chain.participation_contract', '')));
        }
        if ($contract === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $contract)) {
            return ['ok' => false, 'reason' => __('Staking contract is not configured.')];
        }

        $legacyBlock = \App\Support\LegacyParticipationGuard::blockReasonForContract($contract);
        if ($legacyBlock !== null) {
            return ['ok' => false, 'reason' => $legacyBlock];
        }

        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($wallet !== '' && ! preg_match('/^0x[a-f0-9]{40}$/', $wallet)) {
            return ['ok' => false, 'reason' => __('Connect your crypto wallet first.')];
        }

        $txHash = strtolower($txHash);
        if (BlockchainParticipation::query()->where('tx_hash', $txHash)->exists()) {
            return ['ok' => false, 'reason' => __('This transaction is already indexed.')];
        }

        // If profile has no wallet yet, resolve buyer from the tx and bind once.
        if ($wallet === '') {
            $rpc = (string) config('participation_contract.on_chain.rpc_url')
                ?: (string) config('blockchain.rpc_url', '');
            try {
                $tx = $this->rpc($rpc, 'eth_getTransactionByHash', [$txHash]);
                $from = strtolower((string) ($tx['from'] ?? ''));
            } catch (\Throwable) {
                $from = '';
            }
            if ($from === '' || ! preg_match('/^0x[a-f0-9]{40}$/', $from)) {
                return ['ok' => false, 'reason' => __('Connect your crypto wallet first.')];
            }
            $taken = User::query()
                ->whereRaw('LOWER(wallet_address) = ?', [$from])
                ->where('id', '!=', $user->id)
                ->exists();
            if ($taken) {
                return ['ok' => false, 'reason' => __('This wallet is already linked to another account.')];
            }
            $user->forceFill(['wallet_address' => $from])->save();
            $wallet = $from;
        }

        $parsed = $this->parseParticipationTx($txHash, $wallet, $contract);
        if (! $parsed['ok']) {
            return $parsed;
        }

        $this->activation->assertCanPurchaseParticipation($user);

        $principal = number_format((float) $parsed['principal_usdt'], 2, '.', '');
        $min = number_format((float) config('participation_contract.on_chain.min_usdt', 1), 2, '.', '');
        if (bccomp($principal, $min, 2) < 0) {
            return ['ok' => false, 'reason' => __('Staking below minimum $:min.', ['min' => $min])];
        }

        $lockDays = $this->lockDaysFromSeconds((int) $parsed['lock_seconds']);
        if (! RewardPlan::growthDurationIsAllowed($lockDays)) {
            return ['ok' => false, 'reason' => __('Invalid on-chain lock tier.')];
        }

        $qualifying = RewardPlan::isQualifyingParticipationAmount($principal);
        $dailyPct = RewardPlan::growthDailyPercentForDuration($lockDays) ?? 0.0;

        return DB::transaction(function () use ($user, $txHash, $wallet, $contract, $parsed, $principal, $lockDays, $dailyPct, $qualifying) {
            // Display + income eligibility flags (not reward math). $50+ qualifies Member ID.
            $this->markParticipationActiveIfNeeded($user, $qualifying);

            if (\App\Support\BlockchainMode::blockchainOnly()) {
                $record = BlockchainParticipation::query()->create([
                    'user_id' => $user->id,
                    'investment_id' => null,
                    'wallet_address' => $wallet,
                    'tx_hash' => $txHash,
                    'stake_index' => (int) $parsed['stake_index'],
                    'principal_usdt' => $parsed['principal_usdt'],
                    'lock_seconds' => (int) $parsed['lock_seconds'],
                    'daily_rate_bps' => (int) $parsed['daily_rate_bps'],
                    'contract_address' => $contract,
                    'synced_at' => now(),
                ]);

                return ['ok' => true, 'participation' => $record->fresh()];
            }

            $investment = Investment::query()->create([
                'user_id' => $user->id,
                'amount_usd' => $principal,
                'duration_days' => $lockDays,
                'roi_percent_monthly' => number_format($dailyPct * 30, 2, '.', ''),
                'roi_percent_daily' => number_format($dailyPct, 4, '.', ''),
                'total_roi_paid_usd' => '0.00',
                'roi_payouts_done' => 0,
                'cap_multiplier' => '1.00',
                'status' => Investment::STATUS_ACTIVE,
                'next_roi_at' => null,
            ]);

            $record = BlockchainParticipation::query()->create([
                'user_id' => $user->id,
                'investment_id' => $investment->id,
                'wallet_address' => $wallet,
                'tx_hash' => $txHash,
                'stake_index' => (int) $parsed['stake_index'],
                'principal_usdt' => $parsed['principal_usdt'],
                'lock_seconds' => (int) $parsed['lock_seconds'],
                'daily_rate_bps' => (int) $parsed['daily_rate_bps'],
                'contract_address' => $contract,
                'synced_at' => now(),
            ]);

            $this->dispatcher->onNewInvestment($investment, InvestmentRecorder::PAYMENT_USDT_WALLET);

            return ['ok' => true, 'participation' => $record->fresh()];
        });
    }

    /**
     * Mark Laravel member / Member ID active for $50+ stakes (ICO or Engine).
     */
    public function markParticipationActiveIfNeeded(User $user, bool $qualifying): void
    {
        if (! $qualifying) {
            return;
        }

        $patch = [];
        if ($user->participation_activated_at === null) {
            $patch['participation_activated_at'] = now();
        }
        if ($user->id_activated_at === null) {
            $patch['id_activated_at'] = now();
        }
        if ($patch !== []) {
            $user->forceFill($patch)->save();
        }
    }

    /**
     * @return array{ok: bool, reason?: string, principal_usdt?: float, stake_index?: int, lock_seconds?: int, daily_rate_bps?: int}
     */
    public function parseParticipationTx(string $txHash, string $fromWallet, string $contract): array
    {
        $rpc = (string) config('participation_contract.on_chain.rpc_url');
        $eventTopic = strtolower((string) config('participation_contract.events.participation_purchased'));

        try {
            $receipt = $this->rpc($rpc, 'eth_getTransactionReceipt', [$txHash]);
            if (! is_array($receipt) || empty($receipt)) {
                return ['ok' => false, 'reason' => __('Transaction not found. Wait for confirmations.')];
            }

            if (strtolower((string) ($receipt['status'] ?? '')) !== '0x1') {
                return ['ok' => false, 'reason' => __('Transaction failed on-chain.')];
            }

            $tx = $this->rpc($rpc, 'eth_getTransactionByHash', [$txHash]);
            if (! is_array($tx)) {
                return ['ok' => false, 'reason' => __('Could not load transaction.')];
            }

            if (strtolower((string) ($tx['from'] ?? '')) !== $fromWallet) {
                return ['ok' => false, 'reason' => __('Transaction sender does not match your wallet.')];
            }

            $txTo = strtolower((string) ($tx['to'] ?? ''));
            $icoContract = strtolower(trim((string) config('blockchain.contracts.ico', '')));
            $allowedTargets = array_values(array_filter([$contract, $icoContract], fn ($a) => preg_match('/^0x[a-f0-9]{40}$/', $a)));
            if ($txTo === '' || ! in_array($txTo, $allowedTargets, true)) {
                return ['ok' => false, 'reason' => __('Transaction is not a staking / ICO purchase.')];
            }

            // RaceICO.createStake → Engine.openIcoStake emits ParticipationPurchased on Engine (not always tx.to).
            $participationTopics = array_values(array_unique(array_filter([
                $eventTopic,
                '0x771e2f913fe17bca4c8610ec22f97692df4570133fa1f02f726012e653b14e81',
                '0x3cef2b6f76a0f4f96feb02de766f08fcafd52c0677585fad3627da2aa9f2e0d2',
            ])));

            foreach ($receipt['logs'] ?? [] as $log) {
                if (strtolower((string) ($log['address'] ?? '')) !== $contract) {
                    continue;
                }
                $topics = $log['topics'] ?? [];
                if (count($topics) < 1 || ! in_array(strtolower((string) $topics[0]), $participationTopics, true)) {
                    continue;
                }

                $data = (string) ($log['data'] ?? '');
                $decoded = $this->decodeParticipationPurchasedData($data);
                if ($decoded === null) {
                    continue;
                }

                $indexedUser = '0x'.substr(\App\Support\Hex::stripPrefix((string) ($topics[1] ?? '')), -40);
                if (strtolower($indexedUser) !== $fromWallet) {
                    return ['ok' => false, 'reason' => __('Staking event wallet mismatch.')];
                }

                return [
                    'ok' => true,
                    'stake_index' => $decoded['stake_index'],
                    'principal_usdt' => $decoded['principal_usdt'],
                    'lock_seconds' => $decoded['lock_seconds'],
                    'daily_rate_bps' => $decoded['daily_rate_bps'],
                ];
            }

            return ['ok' => false, 'reason' => __('ParticipationPurchased event not found in transaction.')];
        } catch (\Throwable $e) {
            Log::warning('On-chain participation parse failed', ['tx' => $txHash, 'error' => $e->getMessage()]);

            return ['ok' => false, 'reason' => __('Could not verify transaction on BSC.')];
        }
    }

    /**
     * @return array{stake_index: int, principal_usdt: float, lock_seconds: int, daily_rate_bps: int}|null
     */
    private function decodeParticipationPurchasedData(string $hexData): ?array
    {
        // ParticipationPurchased(address indexed user, uint256 stakeIndex, uint256 usdtPaid,
        //   uint256 raceStaked, uint256 lockPeriod, uint256 dailyRateBps) → 5 data words.
        $hex = \App\Support\Hex::stripPrefix($hexData);
        if (strlen($hex) < 64 * 5) {
            return null;
        }

        $words = str_split($hex, 64);
        $stakeIndex = (int) \App\Support\Hex::wordToDecimal($words[0]);
        $principalWei = \App\Support\Hex::wordToDecimal($words[1]);
        $lockSeconds = (int) \App\Support\Hex::wordToDecimal($words[3]);
        $dailyBps = (int) \App\Support\Hex::wordToDecimal($words[4]);

        return [
            'stake_index' => $stakeIndex,
            'principal_usdt' => (float) bcdiv($principalWei, bcpow('10', '18', 0), 8),
            'lock_seconds' => $lockSeconds,
            'daily_rate_bps' => $dailyBps,
        ];
    }

    private function lockDaysFromSeconds(int $seconds): int
    {
        foreach (config('participation_contract.lock_periods', []) as $tier) {
            if ((int) ($tier['seconds'] ?? -1) === $seconds) {
                return (int) ($tier['days'] ?? 0);
            }
        }

        return $seconds === 0 ? 0 : (int) round($seconds / 86400);
    }

  /**
     * @return mixed
     */
    private function rpc(string $rpcUrl, string $method, array $params)
    {
        $response = Http::timeout(15)->post($rpcUrl, [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => $method,
            'params' => $params,
        ]);

        if (! $response->successful()) {
            throw new \RuntimeException('RPC HTTP error');
        }

        return $response->json('result');
    }
}
