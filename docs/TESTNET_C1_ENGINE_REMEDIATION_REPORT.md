# Testnet C-1 — Engine Remediation Report

**Date:** 2026-09-14  
**Network:** BSC Testnet (chain **97**) only  
**Mainnet executed:** **NO**

## Summary

| Check | Result |
|--------|--------|
| C-1 deploy/relink | **PASS** |
| Legacy engine stakes untouched | **PASS** |
| `claimEnabled()` eth_call | **PASS** (returns `false` encoded) |
| MultiSig owner | **PASS** |

## Addresses

| Role | Address |
|------|---------|
| **New** `RaceCommunityEngine` | `0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef` |
| **Deprecated** engine | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| `RaceRewardVault` | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| `RaceICO` | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| MultiSig | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |

## On-chain linkages (live RPC)

- `vault.engine()` → new engine **PASS**
- `ico.stakingEngine()` → new engine **PASS**
- `newEngine.owner()` → MultiSig **PASS**
- `claimEnabled()` → `false` (default until ICO complete + `setClaimEnabled`) **PASS**
- `canClaimRewards` / `lastSuccessfulClaimAt` selectors present **PASS**
- Old engine `stakeCount(deployer)` unchanged (still **1**) **PASS**
- `RaceCoin` not redeployed; ICO `adminWallet` preserved **PASS**

## Artifacts updated

- `contracts/deployments/bscTestnet/deployment.json` — `raceCommunityEngine`, `raceCommunityEngineDeprecated`, `linkages`, `c1EngineRedeployAt`
- Laravel `.env` — `RACE_COMMUNITY_ENGINE_CONTRACT=0xbdDe…`
- Script: `contracts/scripts/redeploy-engine-c1-testnet.js` (resume via `C1_RESUME_NEW_ENGINE`)

## Tests run

```text
npx hardhat test test/RaceCommunityEngineClaimPolicy.test.js  → 8 passing
node scripts/check-testnet-deployment.js                      → PASS
php artisan blockchain:index-events --dry-run                 → new engine + ICO listed
```

## Notes

- First multisig attempt timed out; completed via resume with `C1_RESUME_NEW_ENGINE`.
- Engine `transferOwnership(MultiSig)` sent **directly from deployer** (MultiSig `call` cannot satisfy `onlyOwner` on Ownable).
- **Claim activation** (`setClaimEnabled(true)`) is **not** executed in this batch — requires MultiSig after `RaceICO.icoCompleted()`.

## Rollback reference

- Restore `.env` + `deployment.json` backup; legacy engine remains on-chain with existing stakes.
