<?php

namespace App\Services\Blockchain;

use App\Models\BlockchainEngineStake;
use App\Models\BlockchainEvent;
use App\Models\IcoPurchase;
use App\Models\SiteSetting;
use App\Support\BlockchainMode;
use Illuminate\Support\Facades\Schema;

/**
 * Read-only on-chain snapshot for admin Contracts watch + overall reports.
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
            'fee_admin_wallet' => (string) env('FEE_ADMIN_WALLET', ''),
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
            'multisig' => [],
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
            $multisig = $addresses['multisig'];

            if ($ico !== '') {
                $phase = $this->uint($rpc, $ico, '0xa3a40ea5');
                $live['ico'] = [
                    'phase' => $phase === '0' ? '0 (not started)' : $phase,
                    'phase_raw' => $phase,
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
                $available = $this->uint($rpc, $reserve, '0x48a0d754');
                $live['reserve'] = [
                    'available_race' => $this->token($available),
                    'available_raw' => $available,
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

            if ($multisig !== '' && $race !== '') {
                $live['multisig'] = [
                    'race_balance' => $this->token($this->uint($rpc, $race, $this->balanceOf($multisig))),
                    'owner_note' => '3-of-5 Multisig',
                ];
            }
        } catch (\Throwable) {
            $live['rpc_ok'] = false;
        }

        $events = [];
        if (Schema::hasTable((new BlockchainEvent)->getTable())) {
            $events = BlockchainEvent::query()
                ->latest('id')
                ->limit(40)
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

        $reports = $this->buildReports();
        $catalog = $this->buildCatalog($addresses, $live, $explorer);
        $readiness = $this->buildReadiness($addresses, $live);

        return [
            'chain_id' => $chainId,
            'network' => $chainId === 97 ? 'BSC Testnet' : 'BSC Mainnet',
            'explorer' => $explorer,
            'addresses' => $addresses,
            'live' => $live,
            'events' => $events,
            'catalog' => $catalog,
            'readiness' => $readiness,
            'reports' => $reports,
            'member_flow' => [
                '1' => 'Member opens /ico → Connect wallet (BSC chain '.$chainId.')',
                '2' => 'Approve USDT → Buy & Stake on RaceICO',
                '3' => 'USDT goes to ICO admin wallet',
                '4' => 'RACE leaves ICO reserve (600k bucket) → held / staked via Engine',
                '5' => 'Indexer writes ico_purchases + blockchain_engine_stakes (admin reports)',
            ],
        ];
    }

    /**
     * @param  array<string, string>  $addresses
     * @param  array<string, mixed>  $live
     * @return list<array<string, string>>
     */
    private function buildCatalog(array $addresses, array $live, string $explorer): array
    {
        $tokenSupply = (string) ($live['token']['total_supply'] ?? '—');
        $tokenAdmin = (string) ($live['token']['admin_race'] ?? '—');
        $icoPhase = (string) ($live['ico']['phase'] ?? '—');
        $icoSold = (string) ($live['ico']['sold_race'] ?? '—');
        $icoRaised = (string) ($live['ico']['raised_usdt'] ?? '—');
        $reserveAvail = (string) ($live['reserve']['available_race'] ?? '—');
        $reserveBal = (string) ($live['reserve']['race_balance'] ?? '—');
        $engineStakes = (string) ($live['engine']['stakes_created'] ?? '—');
        $engineLocked = (string) ($live['engine']['locked_race'] ?? '—');
        $engineClaim = (string) ($live['engine']['claim_enabled'] ?? '—');
        $holdRace = (string) ($live['income_hold']['held_race'] ?? '—');
        $oraclePrice = (string) ($live['oracle']['price_usdt'] ?? '');
        $msigRace = (string) ($live['multisig']['race_balance'] ?? '');

        $defs = [
            'race_token' => [
                'label' => 'RACE Token',
                'role' => 'ERC-20 RACE — max supply locked 150M. Ownership tracked on-chain.',
                'status' => ! empty($live['token'])
                    ? 'Supply '.$tokenSupply.' · Admin '.$tokenAdmin
                    : 'Not readable',
            ],
            'multisig' => [
                'label' => 'MultiSig 3-of-5',
                'role' => 'Governance owner for expense / phase start. Never single admin treasury.',
                'status' => $msigRace !== ''
                    ? 'RACE balance '.$msigRace
                    : ($addresses['multisig'] !== '' ? 'Address set' : 'Not set'),
            ],
            'race_ico' => [
                'label' => 'RaceICO (sale)',
                'role' => 'Member Buy & Stake entry. USDT→admin, RACE from reserve.',
                'status' => ! empty($live['ico'])
                    ? 'Phase '.$icoPhase.' · Sold '.$icoSold.' · Raised '.$icoRaised.' USDT'
                    : 'Not readable',
            ],
            'ico_contract' => [
                'label' => 'ICO Contract (reserve)',
                'role' => 'Holds up to 600,000 RACE for ICO sales. Deposit before startPhase(1).',
                'status' => ! empty($live['reserve'])
                    ? 'Available '.$reserveAvail.' · Balance '.$reserveBal
                    : 'Not readable',
            ],
            'ico_admin_wallet' => [
                'label' => 'ICO admin wallet',
                'role' => 'Receives all ICO USDT. Also holds leftover RACE for LP (≈400,000).',
                'status' => $tokenAdmin !== '—' && $tokenAdmin !== ''
                    ? 'RACE '.$tokenAdmin
                    : ($addresses['ico_admin_wallet'] !== '' ? 'Address set' : 'Not set'),
            ],
            'community_engine' => [
                'label' => 'Community Engine',
                'role' => 'Staking + ROI/level income source of truth on-chain.',
                'status' => ! empty($live['engine'])
                    ? 'Stakes '.$engineStakes.' · Locked '.$engineLocked.' · Claim '.$engineClaim
                    : 'Not readable',
            ],
            'reward_vault' => [
                'label' => 'Reward Vault',
                'role' => 'Mints income RACE into IncomeHold (not free wallet mint).',
                'status' => ! empty($live['vault']) ? 'Wired · owner set' : 'Not readable',
            ],
            'income_hold' => [
                'label' => 'Income Hold',
                'role' => 'Holds claimable income RACE until member withdraws.',
                'status' => ! empty($live['income_hold'])
                    ? 'Held RACE '.$holdRace
                    : 'Not readable',
            ],
            'reward_price_oracle' => [
                'label' => 'Reward price oracle',
                'role' => 'RACE/USDT price for income valuation.',
                'status' => $oraclePrice !== ''
                    ? '$'.$oraclePrice
                    : 'Not readable',
            ],
            'treasury' => [
                'label' => 'Company treasury',
                'role' => 'Protocol treasury contract under Multisig.',
                'status' => $addresses['treasury'] !== '' ? 'Address set' : 'Not set',
            ],
            'usdt' => [
                'label' => 'USDT (BEP-20)',
                'role' => 'Payment token for ICO purchases.',
                'status' => $addresses['usdt'] !== '' ? 'Mainnet USDT' : 'Not set',
            ],
            'pancake_router' => [
                'label' => 'PancakeSwap router',
                'role' => 'Swap / LP routing on BSC.',
                'status' => $addresses['pancake_router'] !== '' ? 'Address set' : 'Not set',
            ],
            'fee_admin_wallet' => [
                'label' => 'Fee admin wallet',
                'role' => 'IncomeHold fee sink ($1 / 1% USDT fees).',
                'status' => $addresses['fee_admin_wallet'] !== '' ? 'Address set' : 'Optional / not in .env',
            ],
        ];

        $rows = [];
        foreach ($defs as $key => $def) {
            $addr = trim((string) ($addresses[$key] ?? ''));
            $rows[] = [
                'key' => $key,
                'label' => $def['label'],
                'role' => $def['role'],
                'address' => $addr,
                'status' => $def['status'],
                'explorer_url' => $addr !== '' ? $explorer.'/address/'.$addr : '',
            ];
        }

        return $rows;
    }

    /**
     * @param  array<string, string>  $addresses
     * @param  array<string, mixed>  $live
     * @return list<array{ok: bool, label: string}>
     */
    private function buildReadiness(array $addresses, array $live): array
    {
        $phaseRaw = (string) ($live['ico']['phase_raw'] ?? '0');
        $reserveAvail = (string) ($live['reserve']['available_raw'] ?? '0');
        $reserveOk = bccomp($reserveAvail, '0', 0) === 1;

        return [
            ['ok' => (bool) ($live['rpc_ok'] ?? false), 'label' => 'BSC RPC connected'],
            ['ok' => $addresses['race_token'] !== '', 'label' => 'RACE token address set'],
            ['ok' => $addresses['race_ico'] !== '', 'label' => 'RaceICO (sale) address set'],
            ['ok' => $addresses['ico_contract'] !== '', 'label' => 'ICO reserve (600k) address set'],
            ['ok' => $addresses['community_engine'] !== '', 'label' => 'Community Engine address set'],
            ['ok' => $addresses['ico_admin_wallet'] !== '', 'label' => 'ICO admin wallet set'],
            ['ok' => $reserveOk, 'label' => 'ICO reserve has RACE deposited (available > 0)'],
            ['ok' => $phaseRaw !== '' && $phaseRaw !== '0', 'label' => 'ICO phase started (Multisig startPhase ≥ 1)'],
            ['ok' => ($live['ico']['completed'] ?? 'no') === 'no', 'label' => 'ICO not completed (sales open)'],
            ['ok' => ! empty($live['engine']['ico_contract']) && strcasecmp((string) $live['engine']['ico_contract'], $addresses['race_ico']) === 0, 'label' => 'Engine linked to RaceICO'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildReports(): array
    {
        $out = [
            'ico_buys' => 0,
            'ico_users' => 0,
            'ico_usdt' => '0',
            'ico_race' => '0',
            'stake_rows' => 0,
            'stake_users' => 0,
            'stake_usdt' => '0',
            'stake_race' => '0',
            'recent_purchases' => [],
            'recent_stakes' => [],
        ];

        if (Schema::hasTable((new IcoPurchase)->getTable())) {
            $out['ico_buys'] = (int) IcoPurchase::query()->count();
            $out['ico_users'] = (int) IcoPurchase::query()->distinct('wallet_address')->count('wallet_address');
            $out['ico_usdt'] = (string) (IcoPurchase::query()->sum('usdt_amount') ?: '0');
            $out['ico_race'] = (string) (IcoPurchase::query()->sum('race_amount') ?: '0');
            $out['recent_purchases'] = IcoPurchase::query()
                ->latest('id')
                ->limit(25)
                ->get(['id', 'wallet_address', 'usdt_amount', 'race_amount', 'phase', 'tx_hash', 'created_at', 'status'])
                ->map(static fn (IcoPurchase $p) => [
                    'id' => (int) $p->id,
                    'wallet' => (string) $p->wallet_address,
                    'usdt' => (string) $p->usdt_amount,
                    'race' => (string) $p->race_amount,
                    'phase' => (string) $p->phase,
                    'tx' => (string) $p->tx_hash,
                    'status' => (string) ($p->status ?? ''),
                    'time' => $p->created_at?->toDateTimeString() ?? '—',
                ])
                ->all();
        }

        if (Schema::hasTable((new BlockchainEngineStake)->getTable())) {
            $q = BlockchainEngineStake::query()->where('withdrawn', false);
            $out['stake_rows'] = (int) (clone $q)->count();
            $out['stake_users'] = (int) (clone $q)->distinct('wallet_address')->count('wallet_address');
            $out['stake_usdt'] = (string) ((clone $q)->sum('principal_usdt') ?: '0');
            $out['stake_race'] = (string) ((clone $q)->sum('staked_race') ?: '0');
            $out['recent_stakes'] = BlockchainEngineStake::query()
                ->latest('id')
                ->limit(25)
                ->get(['id', 'wallet_address', 'principal_usdt', 'staked_race', 'source_type', 'status', 'tx_hash', 'created_at'])
                ->map(static fn (BlockchainEngineStake $s) => [
                    'id' => (int) $s->id,
                    'wallet' => (string) $s->wallet_address,
                    'usdt' => (string) $s->principal_usdt,
                    'race' => (string) $s->staked_race,
                    'source' => (string) $s->source_type,
                    'status' => (string) $s->status,
                    'tx' => (string) $s->tx_hash,
                    'time' => $s->created_at?->toDateTimeString() ?? '—',
                ])
                ->all();
        }

        return $out;
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
