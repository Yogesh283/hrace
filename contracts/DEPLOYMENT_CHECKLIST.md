# RACE BSC Deployment Checklist

## Deployment order

1. **RaceMultiSig** (3/5) — governance signers (`MULTISIG_SIGNERS` + `MULTISIG_THRESHOLD=3`)
2. Deploy **RaceTreasury** (Company) + **Development / Marketing / Operations** Multisig funds
3. Wire dependent contracts, then `HARDEN_GOVERNANCE=1` (auto on BSC mainnet):
   ownership → MultiSig for Engine, Oracle, Treasury, RaceCoin, ICO, Vault
4. Verify on-chain owners / fund.multisig match MultiSig (deploy script asserts)
5. **Do not** auto-fund Dev/Marketing/Ops — Expense ≤30M RACE split = business approval
6. Set Laravel `.env` fund addresses; admin **Multisig funds** screen is read-only
2. **RaceCoin** — BEP-20 token (50M supply)
3. **RaceTreasury** + **RaceAutoLiquidity**
4. **RaceEcosystemVault** + **RaceVesting** contracts
5. **PancakeSwap** — create RACE/USDT pair; add liquidity
6. **RaceRewardVault** — fund with program allocation (e.g. 20M RACE)
7. **RaceCommunityEngine** — wire USDT, RACE, router, vault; `vault.setEngine(engine)`
8. **RaceGovernor** — transfer ownership to multisig
9. **RaceLiquidityLocker** — lock LP tokens (5 years)
10. Verify all contracts on BscScan

Legacy (optional, not used when `REWARDS_ENGINE=blockchain_only`):

- RaceParticipation.sol (standalone participation; engine preferred)
- RaceStaking.sol + RaceRewardPool.sol

> **Note:** `$10` RacePlacement / matrix gate removed — registration + participate only.
## Contract dependencies

```
RaceCoin
  └── RaceRewardVault(raceToken)
        └── RaceCommunityEngine(usdt, raceToken, pancakeRouter, vault)
              └── PancakeSwap RACE/USDT pair (live price)
```

## Environment variables (Laravel `.env`)

```env
REWARDS_ENGINE=blockchain_only
BSC_RPC_URL=https://bsc-dataseed.binance.org/
BSC_CHAIN_ID=56
RACE_TOKEN_CONTRACT=0x...
RACE_COMMUNITY_ENGINE_CONTRACT=0x...
RACE_REWARD_VAULT_CONTRACT=0x...
USDT_CONTRACT_BEP20=0x55d398326f99059ff775485246999027b3197955
PANCAKE_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
BLOCKCHAIN_INDEXER_ENABLED=true
BLOCKCHAIN_INDEXER_START_BLOCK=<engine_deploy_block>
```

## BSC deployment steps

```bash
cd contracts
npm install
# Set MULTISIG_SIGNERS in .env for mainnet
npx hardhat run scripts/deploy.js --network bsc
```

Post-deploy:

1. `raceCoin.setFeeExempt(pairAddress, true)`
2. `raceCoin.setFeeExempt(communityEngine, true)`
3. `raceCoin.setFeeExempt(rewardVault, true)`
4. Fund **RaceRewardVault** with RACE allocation
5. Update Laravel `.env` with deployed addresses
6. `php artisan migrate` (blockchain_events tables)
7. `php artisan blockchain:index-events` (verify indexer)
8. Set `REWARDS_ENGINE=blockchain_only`

## Migration checklist (hybrid → decentralized)

- [ ] Deploy RaceCommunityEngine + RaceRewardVault on BSC testnet
- [ ] Fund reward vault
- [ ] Wire `.env` contract addresses
- [ ] Test register + Participation via MetaMask on testnet
- [ ] Confirm `blockchain:index-events` stores all event types
- [ ] Set `REWARDS_ENGINE=blockchain_only` in staging
- [ ] Verify Laravel POST routes return 403 (investment, withdrawal)- [ ] Deploy mainnet
- [ ] Disable legacy income crons (automatic when `blockchain_only`)

## Security

- Admin cannot edit balances, rewards, referrals, or unlock stakes
- Emergency: `engine.pause()` via contract owner/multisig only
- All rewards: USDT value → live Pancake price → RACE transfer to wallet
