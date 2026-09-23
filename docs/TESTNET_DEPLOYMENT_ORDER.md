# TESTNET DEPLOYMENT ORDER

Derived from constructors + `scripts/deploy.js` / `deploy-governance-testnet.js`.

## Guardrails

1. `chainId === 97` only for live testnet  
2. `CONFIRM_TESTNET_DEPLOYMENT=YES`  
3. Override `USDT` + `PANCAKE_ROUTER` to **testnet** addresses (never leave mainnet defaults)  
4. Never run `deploy:mainnet` for this task  

## Order A — Core protocol (`deploy.js` on bscTestnet)

1. RaceMultiSig (5 testnet signers)  
2. RaceCoin  
3. RaceTreasury (Company)  
4. RaceDevelopmentTreasury / Marketing / Operations (MS + RACE + test USDT)  
5. RaceAutoLiquidity  
6. RaceStaking (legacy)  
7. RaceRewardVault  
8. RaceCommunityEngine → `vault.setEngine(engine)`  
9. RaceParticipation (legacy — prefer leave unwired in Laravel)  
10. RaceICO → `setStakingEngine` + `engine.setIcoContract`  
11. RaceRewardPriceOracle (label TESTNET price) → `engine.setRewardPriceOracle`  
12. `engine.setMaturityTreasury(treasury)` + `lockMaturityTreasury`  
13. RaceRewardPool / RaceGovernor / EcosystemVault / Vestings (legacy alloc caps)  
14. RaceCoin fee recipients + feeExempt + `setMinter(ICO)` + `setMinter(Vault)`  
15. Optional LP locker after pair exists  
16. `HARDEN_GOVERNANCE=1` → transfer Engine/Oracle/Treasury/Coin/ICO/Vault **ownership to MultiSig**

## Order B — Community Governance (separate)

1. Deploy RaceGovernance (12 members, threshold 7, periods from env)  
2. Register targets (Engine, Oracle) via constructor initialTargets  
3. **Do not** transfer RaceCoin ownership to Governance  
4. Optional later: Multisig executes `transferOwnership(Governance)` on Engine/Oracle only  

## Post-deploy Laravel / React

Set only testnet addresses; `BSC_CHAIN_ID=97`; block txs if wallet chain ≠ 97.

## Artifacts

Write `deployments/bscTestnet/deployment.json` after successful live deploy (not created until live run succeeds).
