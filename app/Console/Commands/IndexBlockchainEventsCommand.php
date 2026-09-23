<?php

namespace App\Console\Commands;

use App\Models\BlockchainEvent;
use App\Models\IcoPurchase;
use App\Models\User;
use App\Services\Blockchain\BlockchainEngineStakeIndexer;
use App\Services\Blockchain\BscJsonRpcClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Read-only indexer: stores on-chain events for dashboards. Never calculates rewards.
 */
class IndexBlockchainEventsCommand extends Command
{
    protected $signature = 'blockchain:index-events {--dry-run : Report RPC/contracts/blocks without writing DB}';

    protected $description = 'Index Race Community Rewards contract events (read-only).';

    public function handle(): int
    {
        if (! config('blockchain.indexer.enabled')) {
            $this->info('Blockchain indexer disabled.');

            return self::SUCCESS;
        }

        $chainId = (int) config('blockchain.chain_id');
        $rpcClient = BscJsonRpcClient::fromConfig();
        $this->info('Indexer network='.config('blockchain.network').' chain_id='.$chainId);

        foreach ($rpcClient->rpcUrls() as $index => $url) {
            $label = $index === 0 ? 'primary' : 'fallback_'.$index;
            $this->line("RPC {$label}: ".$rpcClient->redactUrl($url));
        }

        $liveChain = $rpcClient->assertExpectedChain();
        if ($liveChain === null) {
            $this->error("STOP: RPC eth_chainId failed or live chainId != configured {$chainId}");

            return self::FAILURE;
        }
        if ($chainId === 56 && filter_var(env('CONFIRM_TESTNET_DEPLOYMENT'), FILTER_VALIDATE_BOOL)) {
            $this->error('STOP: refusing Mainnet index while CONFIRM_TESTNET_DEPLOYMENT is set');

            return self::FAILURE;
        }
        if ($chainId === 97) {
            $this->info('PASS: Testnet chain 97 confirmed on RPC');
        }

        $contracts = array_filter([
            config('blockchain.contracts.community_engine'),
            config('blockchain.contracts.ico'),
            config('income_vault.contract_address'),
            \App\Support\LegacyParticipationGuard::applicationEnabled()
                ? config('blockchain.contracts.participation')
                : null,
        ]);

        if ($contracts === []) {
            $this->warn('No contract addresses configured. Set RACE_*_CONTRACT in .env.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $latest = $rpcClient->call('eth_blockNumber', []);
            $latestBlock = is_string($latest) ? hexdec($latest) : 0;
            $this->info('DRY-RUN: latest block '.$latestBlock);
            $this->info('DRY-RUN: start_block '.config('blockchain.indexer.start_block'));
            $this->info('DRY-RUN: batch_size '.config('blockchain.indexer.batch_size'));
            $this->info('DRY-RUN: log_chunk_size '.config('blockchain.indexer.log_chunk_size'));
            $this->info('DRY-RUN: rpc_retries '.config('blockchain.indexer.rpc_retries'));
            foreach ($contracts as $address) {
                $this->info('DRY-RUN contract: '.strtolower((string) $address));
            }
            $this->info('DRY-RUN complete — no DB writes, no transactions.');

            return self::SUCCESS;
        }

        $failed = false;
        foreach ($contracts as $address) {
            if (! $this->indexContract($rpcClient, strtolower((string) $address))) {
                $failed = true;
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }

    private function indexContract(BscJsonRpcClient $rpcClient, string $contract): bool
    {
        $state = DB::table('blockchain_index_state')
            ->where('contract_address', $contract)
            ->first();

        $fromBlock = $state
            ? (int) $state->last_indexed_block + 1
            : (int) config('blockchain.indexer.start_block', 0);

        $latest = $rpcClient->call('eth_blockNumber', []);
        if (! is_string($latest)) {
            $this->error('RPC eth_blockNumber failed.');

            return false;
        }

        $latestBlock = hexdec($latest);
        $batch = (int) config('blockchain.indexer.batch_size', 2000);
        $toBlock = min($fromBlock + $batch - 1, $latestBlock);

        if ($fromBlock > $toBlock) {
            $this->info("Up to date {$contract} (last indexed >= latest).");

            return true;
        }

        $chunkSize = (int) config('blockchain.indexer.log_chunk_size', 250);
        $logs = $rpcClient->getLogs($contract, $fromBlock, $toBlock, $chunkSize);

        if ($logs === null) {
            $this->error("eth_getLogs failed for {$contract} blocks {$fromBlock}–{$toBlock} (chunk={$chunkSize})");

            return false;
        }

        foreach ($logs as $log) {
            $this->storeLog($contract, $log);
        }

        DB::table('blockchain_index_state')->updateOrInsert(
            ['contract_address' => $contract],
            ['last_indexed_block' => $toBlock, 'updated_at' => now(), 'created_at' => now()],
        );

        $this->info("Indexed {$contract} blocks {$fromBlock}–{$toBlock} (".count($logs).' logs).');

        return true;
    }

    private function storeLog(string $contract, array $log): void
    {
        $txHash = strtolower((string) ($log['transactionHash'] ?? ''));
        $logIndex = hexdec((string) ($log['logIndex'] ?? '0x0'));
        $blockNumber = hexdec((string) ($log['blockNumber'] ?? '0x0'));

        if ($txHash === '' || BlockchainEvent::query()->where('tx_hash', $txHash)->where('log_index', $logIndex)->exists()) {
            return;
        }

        $topics = $log['topics'] ?? [];
        $eventName = $this->resolveEventName($topics[0] ?? null);

        // ICOPurchased: topics[1]=purchaseId, topics[2]=buyer.
        // RaceMintedToStaking: topics[1]=engine, topics[2]=buyer.
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

        $vaultDecoder = app(\App\Services\Blockchain\IncomeVaultEventDecoder::class);
        $vaultName = $vaultDecoder->resolveName($topics[0] ?? null);
        if ($vaultName !== null && strtolower($contract) === strtolower((string) config('income_vault.contract_address'))) {
            $decoded = $vaultDecoder->decode($vaultName, $topics, (string) ($log['data'] ?? '0x'));
            if ($decoded !== null) {
                app(\App\Services\Blockchain\IncomeVaultIndexer::class)->ingestEvent(
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
     * Index ICOPurchased into ico_purchases (history only — never mints RACE).
     *
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

    private function resolveEventName(?string $topic0): string
    {
        // topic0 = keccak256(event signature) — keep in sync with Solidity events.
        $map = [
            '0x3a5a00ec423040dabe80f57799a58598c7a3b374fe3bcc917901b4867b30c908' => 'MemberRegistered',
            '0x03c7da3f3291325a90614f1f44fb39159b4a0b570c27c7dcad54f0891066d005' => 'MemberRegistered',
            '0xe1ff4f9b8e8b5681c85fcf14e247272f9b4a3526e3207e28547d7419005bf134' => 'MemberActivated',
            '0x37a30c83bfb682c70517a0dfc60043aff2fea05fb7c5c81fa30ca94180ff336c' => 'MemberActivated',
            '0x3cef2b6f76a0f4f96feb02de766f08fcafd52c0677585fad3627da2aa9f2e0d2' => 'ParticipationPurchased',
            '0x771e2f913fe17bca4c8610ec22f97692df4570133fa1f02f726012e653b14e81' => 'ParticipationPurchased',
            '0x6a1c9812f6d42eaf5c00058b4fc1d00233e24805a4965009d650401f50adc53e' => 'RewardClaimed', // RewardPaid
            '0xe54fc68849b79ff873dd338d4d2ff76eef5862d086fd81d0f6eb4390b23f10f8' => 'RewardPaid', // legacy topic
            '0xae4ee54fa5e43b33c459251efe0d9f141e6991f03a684990d560e7222f990966' => 'CommunityReferralPaid',
            '0x3eec240434f7a83d20b6901a0fe01ca173ac56d92f2818c8a3c7557bcba20f8d' => 'LeadershipPaid',
            '0x9b8cfdc21efc4f252a435212cd86fe6adbedeab3f60b321fe48c7d351d653c2a' => 'TeamRewardPaid',
            '0x88d1c46373223a4f1f60db2badc985b05ec9c2b2eab4537f0f8e1291b78b6e37' => 'StakeWithdrawn',
            '0x869505c2a2a7c298cb7155a5b1d54056ef5feae04be0a59d5da3c9f438e2e395' => 'StakeWithdrawn', // legacy topic
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
