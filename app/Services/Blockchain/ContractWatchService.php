<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEvent;
use App\Models\SiteSetting;
use App\Support\BlockchainMode;
use Illuminate\Support\Facades\Schema;

/**
 * Read-only on-chain snapshot for the admin Contracts watch page.
 */
final class ContractWatchService
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        $chainId = BlockchainMode::effectiveChainId();
        $explorer = $chainId === 97 ? 'https://testnet.bscscan.com' : 'https://bscscan.com';
        $cfg = config('blockchain.contracts', []);

        $addresses = [
            'race_token' => (string) ($cfg['race_token'] ?? ''),
            'race_ico' => SiteSetting::raceIcoContractAddress(),
            'ico_contract' => SiteSetting::icoContractAddress(),
            'ico_admin_wallet' => SiteSetting::icoAdminWallet(),
            'community_engine' => (string) ($cfg['community_engine'] ?? ''),
            'reward_vault' => (string) ($cfg['reward_vault'] ?? ''),
            'income_hold' => SiteSetting::incomeHoldAddress(),
            'reward_price_oracle' => (string) ($cfg['reward_price_oracle'] ?? ''),
            'usdt' => (string) ($cfg['usdt'] ?? ''),
            'pancake_router' => (string) ($cfg['pancake_router'] ?? ''),
            'multisig' => (string) ($cfg['multisig'] ?? ''),
            'treasury' => (string) ($cfg['treasury'] ?? ''),
            'development_treasury' => (string) ($cfg['development_treasury'] ?? ''),
            'marketing_treasury' => (string) ($cfg['marketing_treasury'] ?? ''),
            'operations_treasury' => (string) ($cfg['operations_treasury'] ?? ''),
        ];

        $live = [
            'rpc_ok' => false,
            'ico' => [],
            'reserve' => [],
            'engine' => [],
            'vault' => [],
            'income_hold' => [],
            'token' => [],
            'oracle' => [],
        ];

        try {
            $rpc = BscJsonRpcClient::fromConfig();
            $live['rpc_ok'] = true;
            $race = $addresses['race_token'];
            $ico = $addresses['race_ico'];
            $reserve = $addresses['ico_contract'];
            $engine = $addresses['community_engine'];
            $vault = $addresses['reward_vault'];
            $hold = $addresses['income_hold'];
            $oracle = $addresses['reward_price_oracle'];
            $admin = $addresses['ico_admin_wallet'];

            if ($ico !== '') {
                $phase = $this->uint($rpc, $ico, '0xa3a40ea5');
                $live['ico'] = [
                    'phase' => $phase === '0' ? '0 (not started)' : $phase,
                    'completed' => $this->bool($rpc, $ico, '0x204e8b17') ? 'yes' : 'no',
                    'sold_race' => $this->token($this->uint($rpc, $ico, '0x8ac8c5a2')),
                    'held_race' => $this->token($this->uint($rpc, $ico, '0x573379bf')),
                    'raised_usdt' => $this->token($this->uint($rpc, $ico, '0xba2d86db')),
                    'admin_wallet' => $this->address($rpc, $ico, '0x36b19cd7'),
                    'reserve' => $this->address($rpc, $ico, '0x071c599f'),
                    'engine' => $this->address($rpc, $ico, '0xa0e38f4e'),
                    'owner' => $this->address($rpc, $ico, '0x8da5cb5b'),
                ];
            }

            if ($reserve !== '') {
                $live['reserve'] = [
                    'available_race' => $this->token($this->uint($rpc, $reserve, '0x48a0d754')),
                    'race_balance' => $race !== '' ? $this->token($this->uint($rpc, $race, $this->balanceOf($reserve))) : '—',
                    'admin' => $this->address($rpc, $reserve, '0xf851a440'),
                    'owner' => $this->address($rpc, $reserve, '0x8da5cb5b'),
                ];
            }

            if ($engine !== '') {
                $live['engine'] = [
                    'claim_enabled' => $this->bool($rpc, $engine, '0x2866ed21') ? 'yes' : 'no',
                    'ico_contract' => $this->address($rpc, $engine, '0xc66e4095'),
                    'income_hold' => $this->address($rpc, $engine, '0xc083a390'),
                    'locked_race' => $this->token($this->uint($rpc, $engine, '0xfe4b3275')),
                    'stakes_created' => $this->uint($rpc, $engine, '0x8615627d'),
                    'owner' => $this->address($rpc, $engine, '0x8da5cb5b'),
                ];
            }

            if ($vault !== '') {
                $live['vault'] = [
                    'income_hold' => $this->address($rpc, $vault, '0xc083a390'),
                    'engine' => $this->address($rpc, $vault, '0xc9d4623f'),
                    'owner' => $this->address($rpc, $vault, '0x8da5cb5b'),
                ];
            }

            if ($hold !== '') {
                $live['income_hold'] = [
                    'admin_wallet' => $this->address($rpc, $hold, '0x36b19cd7'),
                    'held_race' => $race !== '' ? $this->token($this->uint($rpc, $race, $this->balanceOf($hold))) : '—',
                    'owner' => $this->address($rpc, $hold, '0x8da5cb5b'),
                ];
            }

            if ($race !== '') {
                $live['token'] = [
                    'total_supply' => $this->token($this->uint($rpc, $race, '0x18160ddd')),
                    'admin_race' => $admin !== '' ? $this->token($this->uint($rpc, $race, $this->balanceOf($admin))) : '—',
                    'owner' => $this->address($rpc, $race, '0x8da5cb5b'),
                ];
            }

            if ($oracle !== '') {
                $live['oracle'] = [
                    'price_usdt' => $this->token($this->uint($rpc, $oracle, '0xca6268cf')),
                    'owner' => $this->address($rpc, $oracle, '0x8da5cb5b'),
                ];
            }
        } catch (\Throwable) {
            $live['rpc_ok'] = false;
        }

        $events = [];
        if (Schema::hasTable((new BlockchainEvent)->getTable())) {
            $events = BlockchainEvent::query()
                ->latest('id')
                ->limit(25)
                ->get(['event_name', 'tx_hash', 'contract_address', 'wallet_address', 'block_number', 'block_time'])
                ->map(static fn (BlockchainEvent $e) => [
                    'event' => (string) $e->event_name,
                    'tx' => (string) $e->tx_hash,
                    'contract' => (string) $e->contract_address,
                    'wallet' => (string) $e->wallet_address,
                    'block' => (string) $e->block_number,
                    'time' => $e->block_time?->toDateTimeString() ?? '—',
                ])
                ->all();
        }

        return [
            'chain_id' => $chainId,
            'network' => $chainId === 97 ? 'BSC Testnet' : 'BSC',
            'explorer' => $explorer,
            'addresses' => $addresses,
            'live' => $live,
            'events' => $events,
        ];
    }

    private function balanceOf(string $account): string
    {
        return '0x70a08231'.str_pad(strtolower(substr($account, 2)), 64, '0', STR_PAD_LEFT);
    }

    private function uint(BscJsonRpcClient $rpc, string $to, string $data): string
    {
        $hex = $rpc->call('eth_call', [['to' => $to, 'data' => $data], 'latest']);
        if (! is_string($hex) || $hex === '' || $hex === '0x') {
            return '0';
        }

        return $this->hexToDec($hex);
    }

    private function bool(BscJsonRpcClient $rpc, string $to, string $selector): bool
    {
        return $this->uint($rpc, $to, $selector) !== '0';
    }

    private function address(BscJsonRpcClient $rpc, string $to, string $selector): string
    {
        $hex = $rpc->call('eth_call', [['to' => $to, 'data' => $selector], 'latest']);
        if (! is_string($hex) || strlen($hex) < 42) {
            return '—';
        }
        $addr = '0x'.substr($hex, -40);
        if (strtolower($addr) === '0x0000000000000000000000000000000000000000') {
            return 'not set';
        }

        return $addr;
    }

    private function hexToDec(string $hex): string
    {
        $hex = strtolower(preg_replace('/^0x/', '', $hex) ?? '');
        if ($hex === '') {
            return '0';
        }
        $dec = '0';
        foreach (str_split($hex) as $ch) {
            $dec = bcmul($dec, '16', 0);
            $dec = bcadd($dec, (string) hexdec($ch), 0);
        }

        return $dec;
    }

    private function token(string $wei): string
    {
        if ($wei === '0' || $wei === '') {
            return '0';
        }

        return rtrim(rtrim(bcdiv($wei, '1000000000000000000', 4), '0'), '.') ?: '0';
    }
}
