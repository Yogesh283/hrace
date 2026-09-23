<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Read-only Testnet wiring check. Never sends transactions. Never prints secrets.
 */
class VerifyBlockchainTestnetCommand extends Command
{
    protected $signature = 'blockchain:verify-testnet';

    protected $description = 'Verify Laravel is wired to BSC Testnet (chain 97) deployment addresses';

    public function handle(): int
    {
        $chainId = (int) config('blockchain.chain_id');
        $network = (string) config('blockchain.network');
        $rpc = (string) config('blockchain.rpc_url');
        $contracts = (array) config('blockchain.contracts', []);

        $this->info('NETWORK: '.$network);
        $this->info('CONFIG chain_id: '.$chainId);
        $this->info('RPC: '.$this->redactRpc($rpc));

        $ok = true;

        if ($chainId !== 97) {
            $this->error('FAIL: BSC_CHAIN_ID must be 97 for Testnet wiring');
            $ok = false;
        } else {
            $this->info('PASS: config chain_id == 97');
        }

        if ($network !== 'bsc_testnet') {
            $this->warn('WARN: BSC_NETWORK is not bsc_testnet (got '.$network.')');
        }

        if ($rpc === '' || preg_match('/bsc-dataseed\.binance\.org/i', $rpc) && ! preg_match('/testnet|seed-prebsc/i', $rpc)) {
            $this->error('FAIL: RPC looks missing or Mainnet');
            $ok = false;
        }

        $mainnetUsdt = '0x55d398326f99059ff775485246999027b3197955';
        $mainnetRouter = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
        $usdt = strtolower((string) ($contracts['usdt'] ?? ''));
        $router = strtolower((string) ($contracts['pancake_router'] ?? ''));
        if ($usdt === $mainnetUsdt) {
            $this->error('FAIL: USDT is Mainnet official USDT — use TestnetMockUSDT on chain 97');
            $ok = false;
        }
        if ($router === $mainnetRouter) {
            $this->error('FAIL: Pancake router is Mainnet — use Testnet V2 router on chain 97');
            $ok = false;
        }

        $required = [
            'race_token' => 'RaceCoin',
            'multisig' => 'RaceMultiSig',
            'treasury' => 'RaceTreasury',
            'reward_vault' => 'RaceRewardVault',
            'community_engine' => 'RaceCommunityEngine',
            'ico' => 'RaceICO',
            'reward_price_oracle' => 'RaceRewardPriceOracle',
            'usdt' => 'TestnetMockUSDT',
            'pancake_router' => 'Pancake V2',
        ];

        foreach ($required as $key => $label) {
            $addr = trim((string) ($contracts[$key] ?? ''));
            if ($addr === '' || ! preg_match('/^0x[a-fA-F0-9]{40}$/', $addr)) {
                $this->error("FAIL: missing/invalid config blockchain.contracts.{$key} ({$label})");
                $ok = false;
            } else {
                $this->line("CONFIG {$label}: {$addr}");
            }
        }

        $rpcChain = $this->rpc($rpc, 'eth_chainId', []);
        if (! is_string($rpcChain)) {
            $this->error('FAIL: RPC eth_chainId unreachable');

            return self::FAILURE;
        }
        $liveChain = hexdec($rpcChain);
        $this->info('LIVE chain_id: '.$liveChain);
        if ($liveChain !== 97) {
            $this->error('FAIL: live RPC chain_id != 97 (Mainnet or wrong network)');
            $ok = false;
        } else {
            $this->info('PASS: live RPC chain_id == 97');
        }

        $probe = [
            'race_token',
            'community_engine',
            'ico',
            'reward_vault',
            'reward_price_oracle',
            'multisig',
            'usdt',
        ];
        foreach ($probe as $key) {
            $addr = (string) ($contracts[$key] ?? '');
            if ($addr === '') {
                continue;
            }
            $code = $this->rpc($rpc, 'eth_getCode', [$addr, 'latest']);
            $has = is_string($code) && $code !== '' && $code !== '0x';
            if ($has) {
                $this->info("PASS: bytecode {$key} {$addr}");
            } else {
                $this->error("FAIL: no bytecode {$key} {$addr}");
                $ok = false;
            }
        }

        $icoPayload = \App\Services\Blockchain\BlockchainContractPayload::icoPagePayload();
        $this->info('ICO payload chain_id: '.($icoPayload['chain_id'] ?? 'missing'));
        $this->info('ICO payload on_chain_enabled: '.(($icoPayload['on_chain_enabled'] ?? false) ? 'true' : 'false'));
        $this->info('ICO payload engine_ready: '.(($icoPayload['engine_ready'] ?? false) ? 'true' : 'false'));
        $this->info('ICO payload ico_ready: '.(($icoPayload['ico_ready'] ?? false) ? 'true' : 'false'));
        $this->line('ICO community_engine: '.($icoPayload['community_engine'] ?? '(missing)'));
        $this->line('ICO ico_contract: '.($icoPayload['ico_contract'] ?? '(missing)'));
        $this->line('ICO usdt_contract: '.($icoPayload['usdt_contract'] ?? '(missing)'));
        $this->info('ICO stake_plans: '.count($icoPayload['stake_plans'] ?? []));

        if (! ($icoPayload['on_chain_enabled'] ?? false)) {
            $this->error('FAIL: ICO on_chain_enabled is false on Testnet');
            $ok = false;
        }
        if (! ($icoPayload['engine_ready'] ?? false)) {
            $this->error('FAIL: ICO engine_ready is false');
            $ok = false;
        }
        if (! ($icoPayload['ico_ready'] ?? false)) {
            $this->error('FAIL: ICO ico_ready is false');
            $ok = false;
        }
        if (count($icoPayload['stake_plans'] ?? []) < 4) {
            $this->error('FAIL: ICO stake_plans must include 180/365/730/1095');
            $ok = false;
        }

        if ($ok) {
            $this->info('LARAVEL_TESTNET_WIRING probe: PASS');

            return self::SUCCESS;
        }

        $this->error('LARAVEL_TESTNET_WIRING probe: FAIL');

        return self::FAILURE;
    }

    private function redactRpc(string $rpc): string
    {
        if ($rpc === '') {
            return '(empty)';
        }
        $parts = parse_url($rpc);

        return ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? 'unknown');
    }

    private function rpc(string $url, string $method, array $params): mixed
    {
        $response = Http::timeout(20)->post($url, [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => $method,
            'params' => $params,
        ]);

        return $response->json('result');
    }
}
