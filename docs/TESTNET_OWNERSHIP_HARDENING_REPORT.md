# Testnet Ownership Hardening Report

**Network:** BSC Testnet (97)  
**MultiSig:** `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` (3-of-5, **UNCHANGED**)  
**Deployer:** `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984`  
**Community Governance:** not deployed in this run (optional)

## Critical RaceCoin rule

`RaceCoin.governanceMint` is gated by `onlyGovernance` (separate `governance` address).  
**Do NOT** transfer RaceCoin **ownership** to Community Governance — owner can `setGovernance` / `setMinter` and create mint risk.  
**Target owner for RaceCoin:** RaceMultiSig only.

---

## Per-contract plan (pre → post harden)

| Contract | Current owner (before harden) | Target owner | Governance control? | MultiSig control? | Transfer safe? | Required tx |
|----------|-------------------------------|--------------|---------------------|-------------------|----------------|-------------|
| RaceCoin | Deployer | **MultiSig** | No (do not give ownership) | Yes — `setMinter` / fees | **Yes** → MultiSig | `transferOwnership(MultiSig)` |
| RaceICO | Deployer | **MultiSig** | No | Yes — phases / settings | Yes | `transferOwnership(MultiSig)` |
| RaceCommunityEngine | Deployer | **MultiSig** | No unrestricted | Yes — admin params | Yes | `transferOwnership(MultiSig)` |
| RaceRewardPriceOracle | Deployer | **MultiSig** | No | Yes — bounds/staleness; **updater stays EOA** | Yes | `setUpdater` then `transferOwnership(MultiSig)` |
| RaceRewardVault | Deployer | **MultiSig** | No | Yes — `setEngine` | Yes | `transferOwnership(MultiSig)` |
| RaceTreasury | Deployer (withdraw = MultiSig already) | **MultiSig** | No | Yes — `setMultisig` + withdraw already MS | Yes | `transferOwnership(MultiSig)` |
| RaceDevelopmentTreasury | MultiSig (constructor) | MultiSig | No | Yes | Already | none |
| RaceMarketingTreasury | MultiSig (constructor) | MultiSig | No | Yes | Already | none |
| RaceOperationsTreasury | MultiSig (constructor) | MultiSig | No | Yes | Already | none |
| RaceAutoLiquidity | Deployer | Keep deployer or MultiSig later | No | Optional | Optional | not required for smoke |
| RaceGovernor (legacy stake-weighted) | n/a (immutable staking link) | Leave | Legacy | No bypass of MultiSig | Leave | none |
| RaceStaking / RaceParticipation | Deployer | Leave (legacy / parallel) | No | Optional | Leave for now | none |
| RaceEcosystemVault / Vesting | Per deploy wiring | Leave | DAO release paths | MultiSig where coded | Leave | none |
| RaceLiquidityLocker | Not deployed | — | — | — | — | after LP |

## Oracle updater

| Item | Value |
|------|--------|
| Storage | `mapping(address => bool) isUpdater` |
| Activate | `setUpdater(account, true)` — `onlyOwner` |
| Price push | `updatePrice` — updater **or** owner |
| Why assert failed | `ORACLE_UPDATER` defaulted to **MultiSig** but `setUpdater` only ran when `HARDEN_GOVERNANCE=1` (was unset) |
| Testnet rule | Explicit `ORACLE_UPDATER` EOA required — no MultiSig silent fallback |

## Execution order

1. `setUpdater(ORACLE_UPDATER, true)` while deployer still owns oracle  
2. Confirm `racePriceUsdt()`  
3. Transfer ownership of Engine / Oracle / Treasury / RaceCoin / ICO / Vault → MultiSig  
4. Re-check `isUpdater(ORACLE_UPDATER)` still true  

RaceMultiSig.sol: **not modified**. Threshold: **3**. Signers: **unchanged**.
