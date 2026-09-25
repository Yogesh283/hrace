<?php

namespace App\Services\Blockchain;

use App\Support\BlockchainMode;
use App\Support\RewardPlan;

/**
 * Read-only Web3 contract addresses and UI payload for member pages.
 */
final class BlockchainContractPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function enginePayload(): array
    {
        $blockchainOnly = BlockchainMode::blockchainOnly();
        $onChainEnabled = BlockchainMode::onChainEnabled();

        $engine = (string) config('blockchain.contracts.community_engine', '');
        $participation = \App\Support\LegacyParticipationGuard::applicationEnabled()
            ? (string) config('blockchain.contracts.participation', '')
            : '';

        $contract = $engine !== '' ? $engine : $participation;

        return [
            'enabled' => $onChainEnabled && $contract !== '',
            'on_chain_enabled' => $onChainEnabled,
            'blockchain_only' => $blockchainOnly,
            'chain_id' => BlockchainMode::effectiveChainId(),
            'network' => (string) config('blockchain.network', BlockchainMode::effectiveChainId() === 97 ? 'bsc_testnet' : 'bsc'),
            'is_testnet' => BlockchainMode::effectiveChainId() === 97,
            'engine_contract' => $engine,
            'participation_contract' => $participation,
            'contract' => $contract,
            'usdt_contract' => (string) config('blockchain.contracts.usdt', config('participation_contract.on_chain.usdt_contract', '')),
            'income_hold' => \App\Models\SiteSetting::incomeHoldAddress(),
            'min_usdt' => number_format((float) RewardPlan::builtForGrowth()['min_amount_usd'], 2, '.', ''),
            'qualifying_usdt' => number_format(RewardPlan::participationQualifyingMinUsd(), 2, '.', ''),
            'lock_tiers' => self::lockTiers(),
            'stake_withdraw_fee_percent' => number_format(
                (float) config('participation_contract.stake_withdraw_fee_bps', 1000) / 100,
                2,
                '.',
                '',
            ),
        ];
    }

    /**
     * Read-only payload for the on-chain RACE token utility page.
     *
     * @return array<string, mixed>
     */
    public static function tokenPagePayload(): array
    {
        $engine = self::enginePayload();
        $raceToken = (string) config('blockchain.contracts.race_token', '');
        $pancakeRouter = (string) config('blockchain.contracts.pancake_router', '');
        $usdt = (string) config('blockchain.contracts.usdt', '');
        $chainId = BlockchainMode::effectiveChainId();
        $engineAddress = (string) ($engine['engine_contract'] ?? '');
        $networkName = match ($chainId) {
            97 => 'BNB Smart Chain Testnet',
            56 => 'BNB Smart Chain',
            default => 'BSC',
        };
        $explorer = $chainId === 97 ? 'https://testnet.bscscan.com' : ($chainId === 56 ? 'https://bscscan.com' : 'https://bscscan.com');

        return [
            'chain_id' => $chainId,
            'network' => (string) config('blockchain.network', $chainId === 97 ? 'bsc_testnet' : 'bsc'),
            'is_testnet' => $chainId === 97,
            'network_name' => $networkName,
            'block_explorer' => $explorer,
            'race_token' => $raceToken,
            'pancake_router' => $pancakeRouter,
            'usdt_contract' => $usdt,
            'contracts' => [
                'race_token' => $raceToken,
                'community_engine' => $engineAddress,
                'participation' => (string) ($engine['participation_contract'] ?? ''),
                'reward_vault' => (string) config('blockchain.contracts.reward_vault', ''),
                'reward_price_oracle' => (string) config('blockchain.contracts.reward_price_oracle', ''),
                'treasury' => (string) config('blockchain.contracts.treasury', ''),
                'multisig' => (string) config('blockchain.contracts.multisig', ''),
                'governor' => (string) config('blockchain.contracts.governor', ''),
                'governance' => (string) config('blockchain.contracts.governance', ''),
                'auto_liquidity' => (string) config('blockchain.contracts.auto_liquidity', ''),
                'ico' => (string) config('blockchain.contracts.ico', ''),
                'income_hold' => \App\Models\SiteSetting::incomeHoldAddress(),
                'pancake_router' => $pancakeRouter,
                'usdt' => $usdt,
            ],
            'contracts_deployed' => $raceToken !== '' && $pancakeRouter !== '' && $usdt !== '',
            'engine_deployed' => $engineAddress !== '',
            'default_slippage_bps' => 100,
            'swap_deadline_seconds' => 1200,
            'rpc_url' => (string) config('blockchain.rpc_url', ''),
            'engine' => $engine,
        ];
    }

    /**
     * Read-only payload for the official RACE ICO purchase page.
     *
     * @return array<string, mixed>
     */
    public static function icoPagePayload(): array
    {
        $token = self::tokenPagePayload();
        $ico = \App\Models\SiteSetting::raceIcoContractAddress();
        $engine = (string) config('blockchain.contracts.community_engine', '');
        $raceToken = (string) ($token['race_token'] ?? '');
        $usdt = (string) ($token['usdt_contract'] ?? '');
        $onChainEnabled = BlockchainMode::onChainEnabled();
        $engineReady = $onChainEnabled && $engine !== '';
        $contractsDeployed = $ico !== '' && $raceToken !== '' && $usdt !== '' && $engine !== '';
        $icoReady = $contractsDeployed && $engineReady;

        $payload = [
            'chain_id' => $token['chain_id'],
            'network' => (string) ($token['network'] ?? config('blockchain.network', 'bsc')),
            'network_name' => $token['network_name'],
            'block_explorer' => $token['block_explorer'],
            'rpc_url' => $token['rpc_url'],
            'is_testnet' => (bool) ($token['is_testnet'] ?? false),
            'ico_contract' => $ico,
            'race_token' => $raceToken,
            'usdt_contract' => $usdt,
            'contracts_deployed' => $contractsDeployed,
            'on_chain_enabled' => $onChainEnabled,
            'engine_deployed' => $engine !== '',
            'engine_ready' => $engineReady,
            'ico_ready' => $icoReady,
            'total_allocation' => '600000',
            'community_engine' => $engine,
            'contracts' => [
                'race_token' => $raceToken,
                'ico' => $ico,
                'community_engine' => $engine,
                'usdt' => $usdt,
            ],
            'stake_plans' => [
                ['id' => '180', 'days' => 180, 'seconds' => 180 * 86400, 'label' => '180 Days', 'daily_roi_percent' => '0.50', 'lock_label' => 'Locked 180 days'],
                ['id' => '365', 'days' => 365, 'seconds' => 365 * 86400, 'label' => '365 Days', 'daily_roi_percent' => '0.70', 'lock_label' => 'Locked 365 days'],
                ['id' => '730', 'days' => 730, 'seconds' => 730 * 86400, 'label' => '730 Days', 'daily_roi_percent' => '0.90', 'lock_label' => 'Locked 730 days'],
                ['id' => '1095', 'days' => 1095, 'seconds' => 1095 * 86400, 'label' => '1095 Days', 'daily_roi_percent' => '1.00', 'lock_label' => 'Locked 1095 days'],
            ],
            'flexible_plan' => [
                'id' => 'flexible',
                'days' => 0,
                'seconds' => 0,
                'label' => 'Flexible',
                'daily_roi_percent' => '0.35',
                'lock_label' => 'No fixed lock — withdraw anytime (after ICO)',
                'available' => 'after_ico',
            ],
            'note' => 'ICO = fixed stake plans only. Flexible 0.35% daily is available post-ICO via Engine.participate after icoCompleted.',
            'mint_model' => true,
            'mint_to_stake' => true,
            'ico_allows_flexible' => false,
        ];

        if (config('app.debug')) {
            $payload['debug'] = [
                'chain_id' => $payload['chain_id'],
                'network' => $payload['network'],
                'race_ico' => $payload['ico_contract'],
                'race_community_engine' => $payload['community_engine'],
                'usdt' => $payload['usdt_contract'],
                'on_chain_enabled' => $onChainEnabled,
                'engine_ready' => $engineReady,
                'ico_ready' => $icoReady,
            ];
        }

        return $payload;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function lockTiers(): array
    {
        $periods = config('participation_contract.lock_periods', []);

        if ($periods !== []) {
            return collect($periods)
                ->map(static fn ($tier) => [
                    'days' => (int) ($tier['days'] ?? 0),
                    'seconds' => (int) ($tier['seconds'] ?? 0),
                    'label' => (string) ($tier['label'] ?? ''),
                    'daily_roi_percent' => number_format(((int) ($tier['daily_rate_bps'] ?? 0)) / 100, 2, '.', ''),
                ])
                ->values()
                ->all();
        }

        return RewardPlan::builtForGrowthDurationTiersForUi();
    }
}
