<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEvent;
use App\Models\IcoPurchase;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Read-only ingest of Engine/ICO/Vault logs into Laravel tables.
 * Never mints RACE or calculates rewards — history / dashboards only.
 */
class BlockchainEventIngestService
{
    /**
     * Pull receipt for one tx and ingest every log from known contracts.
     *
     * @return array{ok: bool, reason?: string, events_indexed: int, event_names: list<string>}
     */
    public function ingestFromTxHash(string $txHash): array
    {
        $txHash = strtolower(trim($txHash));
        if (! preg_match('/^0x[a-f0-9]{64}$/', $txHash)) {
            return ['ok' => false, 'reason' => 'Invalid transaction hash.', 'events_indexed' => 0, 'event_names' => []];
        }

        $rpc = BscJsonRpcClient::fromConfig();
        if ($rpc->assertExpectedChain() === null) {
            return ['ok' => false, 'reason' => 'RPC chain mismatch.', 'events_indexed' => 0, 'event_names' => []];
        }

        $receipt = $rpc->call('eth_getTransactionReceipt', [$txHash]);
        if (! is_array($receipt) || $receipt === []) {
            return ['ok' => false, 'reason' => 'Transaction not found. Wait for confirmations.', 'events_indexed' => 0, 'event_names' => []];
        }

        if (strtolower((string) ($receipt['status'] ?? '')) !== '0x1') {
            return ['ok' => false, 'reason' => 'Transaction failed on-chain.', 'events_indexed' => 0, 'event_names' => []];
        }

        $allowed = $this->allowedContracts();
        $indexed = 0;
        $names = [];

        foreach ($receipt['logs'] ?? [] as $log) {
            if (! is_array($log)) {
                continue;
            }
            $contract = strtolower((string) ($log['address'] ?? ''));
            if ($contract === '' || ($allowed !== [] && ! isset($allowed[$contract]))) {
                continue;
            }
            $before = BlockchainEvent::query()
                ->where('tx_hash', $txHash)
                ->where('log_index', hexdec((string) ($log['logIndex'] ?? '0x0')))
                ->exists();
            $this->storeLog($contract, $log);
            if (! $before) {
                $after = BlockchainEvent::query()
                    ->where('tx_hash', $txHash)
                    ->where('log_index', hexdec((string) ($log['logIndex'] ?? '0x0')))
                    ->exists();
                if ($after) {
                    $indexed++;
                    $topics = $log['topics'] ?? [];
                    $names[] = $this->resolveEventName($topics[0] ?? null);
                }
            }
        }

        return [
            'ok' => true,
            'events_indexed' => $indexed,
            'event_names' => array_values(array_unique($names)),
        ];
    }

    /**
     * @return array<string, true>
     */
    public function allowedContracts(): array
    {
        $list = array_filter([
            config('blockchain.contracts.community_engine'),
            config('blockchain.contracts.ico'),
            config('income_vault.contract_address'),
            \App\Support\LegacyParticipationGuard::applicationEnabled()
                ? config('blockchain.contracts.participation')
                : null,
        ]);

        $map = [];
        foreach ($list as $addr) {
            $a = strtolower(trim((string) $addr));
            if (preg_match('/^0x[a-f0-9]{40}$/', $a)) {
                $map[$a] = true;
            }
        }

        return $map;
    }

    /**
     * @param  array<string, mixed>  $log
     */
    public function storeLog(string $contract, array $log): void
    {
        $txHash = strtolower((string) ($log['transactionHash'] ?? ''));
        $logIndex = hexdec((string) ($log['logIndex'] ?? '0x0'));
        $blockNumber = hexdec((string) ($log['blockNumber'] ?? '0x0'));

        if ($txHash === '' || BlockchainEvent::query()->where('tx_hash', $txHash)->where('log_index', $logIndex)->exists()) {
            return;
        }

        $topics = $log['topics'] ?? [];
        $eventName = $this->resolveEventName($topics[0] ?? null);

        $walletTopicIndex = match ($eventName) {
            'ICOPurchased', 'RaceMintedToStaking' => 2,
            default => 1,
        };
        $wallet = isset($topics[$walletTopicIndex])
            ? '0x'.substr((string) $topics[$walletTopicIndex], 26)
            : '';

        $userId = $wallet !== ''
            ? User::query()->whereRaw('LOWER(wallet_address) = ?', [strtolower($wallet)])->value('id')
            : null;

        BlockchainEvent::query()->create([
            'user_id' => $userId,
            'wallet_address' => strtolower($wallet),
            'contract_address' => $contract,
            'event_name' => $eventName,
            'tx_hash' => $txHash,
            'log_index' => $logIndex,
            'block_number' => $blockNumber,
            'payload' => [
                'topics' => $topics,
                'data' => $log['data'] ?? null,
            ],
            'block_time' => null,
        ]);

        if ($eventName === 'ICOPurchased') {
            $this->storeIcoPurchase($topics, (string) ($log['data'] ?? ''), $txHash, $blockNumber, $userId);
        }

        $stakeIndexer = app(BlockchainEngineStakeIndexer::class);
        if ($eventName === 'ICOStakeCreated') {
            $stakeIndexer->storeIcoStakeCreated(
                $topics,
                (string) ($log['data'] ?? ''),
                $txHash,
                $blockNumber,
                $contract,
                $userId,
            );
        }
        if ($eventName === 'StakeWithdrawn' || $eventName === 'StakeCompleted') {
            $stakeIndexer->markStakeWithdrawn($topics, (string) ($log['data'] ?? ''), $contract);
        }

        $vaultDecoder = app(IncomeVaultEventDecoder::class);
        $vaultName = $vaultDecoder->resolveName($topics[0] ?? null);
        $vaultContract = strtolower((string) config('income_vault.contract_address'));
        if ($vaultName !== null && $vaultContract !== '' && strtolower($contract) === $vaultContract) {
            $decoded = $vaultDecoder->decode($vaultName, $topics, (string) ($log['data'] ?? '0x'));
            if ($decoded !== null) {
                app(IncomeVaultIndexer::class)->ingestEvent(
                    $vaultName,
                    $decoded,
                    $txHash,
                    $blockNumber,
                    $logIndex,
                    $contract,
                    (int) config('blockchain.chain_id', 97),
                    null,
                    isset($topics[0]) ? strtolower((string) $topics[0]) : null,
                );
            }
        }
    }

    /**
     * @param  list<string>  $topics
     */
    private function storeIcoPurchase(array $topics, string $data, string $txHash, int $blockNumber, mixed $userId): void
    {
        $purchaseId = isset($topics[1]) ? hexdec((string) $topics[1]) : 0;
        $wallet = isset($topics[2]) ? '0x'.substr((string) $topics[2], 26) : '';
        if ($purchaseId < 0 || $wallet === '' || $txHash === '') {
            return;
        }

        if (IcoPurchase::query()->where('tx_hash', $txHash)->where('purchase_id', $purchaseId)->exists()) {
            return;
        }

        $hex = Str::lower(Str::startsWith($data, '0x') ? substr($data, 2) : $data);
        if (strlen($hex) < 256) {
            return;
        }

        $phase = (int) hexdec(substr($hex, 0, 64));
        $usdtWei = $this->hexToDecimalString(substr($hex, 64, 64));
        $raceWei = $this->hexToDecimalString(substr($hex, 128, 64));
        $priceWei = $this->hexToDecimalString(substr($hex, 192, 64));

        IcoPurchase::query()->create([
            'purchase_id' => $purchaseId,
            'user_id' => $userId,
            'wallet_address' => strtolower($wallet),
            'phase' => $phase,
            'usdt_amount' => $this->weiToToken($usdtWei),
            'race_amount' => $this->weiToToken($raceWei),
            'price' => $this->weiToToken($priceWei),
            'tx_hash' => $txHash,
            'block_number' => $blockNumber,
            'status' => 'confirmed',
        ]);
    }

    private function hexToDecimalString(string $hex64): string
    {
        $hex = ltrim($hex64, '0');
        if ($hex === '') {
            return '0';
        }

        return function_exists('gmp_init')
            ? gmp_strval(gmp_init($hex, 16), 10)
            : (string) hexdec($hex);
    }

    private function weiToToken(string $wei): string
    {
        if (! function_exists('bcdiv')) {
            return number_format(((float) $wei) / 1e18, 18, '.', '');
        }

        return bcdiv($wei, '1000000000000000000', 18);
    }

    public function resolveEventName(?string $topic0): string
    {
        $map = [
            '0x3a5a00ec423040dabe80f57799a58598c7a3b374fe3bcc917901b4867b30c908' => 'MemberRegistered',
            '0x03c7da3f3291325a90614f1f44fb39159b4a0b570c27c7dcad54f0891066d005' => 'MemberRegistered',
            '0xe1ff4f9b8e8b5681c85fcf14e247272f9b4a3526e3207e28547d7419005bf134' => 'MemberActivated',
            '0x37a30c83bfb682c70517a0dfc60043aff2fea05fb7c5c81fa30ca94180ff336c' => 'MemberActivated',
            '0x3cef2b6f76a0f4f96feb02de766f08fcafd52c0677585fad3627da2aa9f2e0d2' => 'ParticipationPurchased',
            '0x771e2f913fe17bca4c8610ec22f97692df4570133fa1f02f726012e653b14e81' => 'ParticipationPurchased',
            '0x6a1c9812f6d42eaf5c00058b4fc1d00233e24805a4965009d650401f50adc53e' => 'RewardClaimed',
            '0xe54fc68849b79ff873dd338d4d2ff76eef5862d086fd81d0f6eb4390b23f10f8' => 'RewardPaid',
            '0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966' => 'CommunityReferralPaid',
            '0x3eec240434f7a83d20b6901a0fe01ca173ac56d92f2818c8a3c7557bcba20f8d' => 'LeadershipPaid',
            '0x9b8cfdc21efc4f252a435212cd86fe6adbedeab3f60b321fe48c7d351d653c2a' => 'TeamRewardPaid',
            '0x88d1c46373223a4f1f60db2badc985b05ec9c2b2eab4537f0f8e1291b78b6e37' => 'StakeWithdrawn',
            '0x869505c2a2a7c298cb7155a5b1d54056ef5feae04be0a59d5da3c9f438e2e395' => 'StakeWithdrawn',
            '0x17c51d222f104b66418e7628c6f3411a54578cbb08ad1bee79e626157980d6ed' => 'RankUpdated',
            '0x7f822dd71f32cfb5c893fd7093790736694f76f1a71a757d16e8d23f7eaef963' => 'ICOPurchased',
            '0x1f3dc78e5383429821420268e8c7ab7fa1979caa09b4bc4f9c40d2bdf2c44c5f' => 'ICOPurchase',
            '0x49dfa5eafc5faed8484236c52885a8d1913aceab61263e09f37f0b915b184e26' => 'UsdtTransferredToAdmin',
            '0x3bbaced029028afbe3622c5c505c56f82a87ba3bfd76b003656a0147f83db5ee' => 'ICOStakeCreated',
            '0x172683bc9e168fd8e43e442d0e5392595c48b43230044dee7c406e017e52c510' => 'RewardCompounded',
            '0x3a060e9b2a16c3554bd377e06cdca2024531405e6b5b6dbea7daf919843f9ba0' => 'RaceMintedToStaking',
            '0x0f392fab93032b655a2790a0aa9babb8772dad4d3bf28e0b2f7f3b6a2ae6fae3' => 'StakeCompleted',
            '0x928d734f8511c4d99022a77537725f436b16d1f342edd1a5d66bc28432939580' => 'StakeMatured',
            '0xd6cbeb8fb06a3dc6bbdcb20549e0e06d2c36ce056c6e7c761a90103a6549910b' => 'MaturityFeePaid',
            '0x8c73a49f3f6586364f59cf469ef269547fcedb2de29dd6c3b36991ca934ae4cd' => 'EmiScheduleCreated',
            '0x91cc73c8d39d5d45410514a0b5cc2654f38ea8ea2d107a94d97b380896e38ff1' => 'EmiClaimed',
            '0x0cb4112864bc0c6ec295623acc6a9ba59fea56470dea9a9c148147e0fcacb7e5' => 'ClaimEnabledUpdated',
            '0xfb35bc3dbd47c90557125dfd782126de55fa2234e0af58ca22cb1fbe2192df71' => 'ClaimCooldownRecorded',
        ];

        $key = strtolower((string) $topic0);

        return $map[$key] ?? 'Unknown';
    }
}
