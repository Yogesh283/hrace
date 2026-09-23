# Testnet Deployment Completion Report

**Date:** 2026-09-13  
**Chain:** BSC Testnet **97**  
**RaceMultiSig.sol:** UNCHANGED (3-of-5)  
**Fresh `deploy:testnet`:** NOT re-run (resume only)

---

## Root cause of original stop

`deploy.js` set `oracleUpdater = ORACLE_UPDATER || multiSigAddress`.  
`HARDEN_GOVERNANCE` was unset, so `setUpdater(MultiSig)` never ran.  
Assertion still checked `isUpdater(MultiSig)` → **FAIL**.  
Deployer was already an active updater from the oracle constructor.

---

## Existing contracts (not redeployed)

| Contract | Address |
|----------|---------|
| RaceMultiSig | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| RaceCoin | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| RaceTreasury | `0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A` |
| RaceDevelopmentTreasury | `0xfFfF27aFdADf6F58276d2293A3246eDAd2B4cd5f` |
| RaceMarketingTreasury | `0x67e5d4ab5187a9292F47e7FeC6a0b067dD64084A` |
| RaceOperationsTreasury | `0x08Bba9326DbCc9f7f9C615dDb4889656e1C3cCFA` |
| RaceAutoLiquidity | `0xafC443895FAb63F4221B50Cc9dceB46ce925F146` |
| RaceStaking | `0xA31C053767034C86BaB132B53686AAb7898255A3` |
| RaceRewardVault | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| RaceCommunityEngine | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| RaceParticipation | `0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5` |
| RaceICO | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| RaceRewardPriceOracle | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| RaceRewardPool | `0x77116d2B7f00F17fdEA1E2076dBAEfD257E004C8` |
| RaceGovernor (legacy) | `0xD53De472E9363B5eA08BAF919955B6332575A85D` |
| RaceEcosystemVault | `0x6bBBe3AB18f2639c2Ade66F68D1F4edf32Bdc6D9` |
| Vestings | strategic / dev / partnerships (see deployment.json) |
| TestnetMockUSDT | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| Pancake V2 router | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` |
| RaceLiquidityLocker | not deployed (needs LP_TOKEN) |
| RaceGovernance (community) | not deployed |

Manifest: `contracts/deployments/bscTestnet/deployment.json`

---

## Oracle

| Item | Status |
|------|--------|
| Updater | `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` (dedicated ops = deployer) |
| `isUpdater` | **true** |
| Price | `$1` / RACE (`1e18` wei) — reward settlement oracle, not Pancake |
| Heartbeat tx | `0xbf2ac9019b4e2bd9cf94b7ff5f4d3243986aaf3730bbe934cbdd939ea1974b01` |
| Owner after harden | MultiSig |
| Result | **PASS** |

Future `deploy.js` on Testnet: **requires** `ORACLE_UPDATER` (no MultiSig silent fallback).

---

## Ownership hardening

| Contract | Owner |
|----------|--------|
| RaceCoin / Engine / Vault / ICO / Oracle / Treasury | MultiSig |
| Expense treasuries | MultiSig (constructor) |
| RaceCoin → Community Governance | **NOT done** (mint-risk rule preserved) |

See `docs/TESTNET_OWNERSHIP_HARDENING_REPORT.md`.  
Result: **PASS**

Sample ownership txs:
- Oracle → MS: `0x88c4b74f…c36e`
- Engine → MS: `0x0773979a…af4e`
- Treasury → MS: `0x439596ab…f085`
- RaceCoin → MS: `0x0c45da61…5d6c`
- ICO → MS: `0x2e418685…2fdf`
- Vault → MS: `0xfab5a9d5…5fec`

---

## MultiSig / Governance / linkages

| Item | Status |
|------|--------|
| MultiSig threshold | 3 |
| Signers | 5 (unchanged) |
| Community Governance | not deployed |
| Vault ↔ Engine | linked |
| ICO ↔ Engine | linked |
| Engine ↔ Oracle | linked |
| Minters | RaceICO + RaceRewardVault |

---

## Tests

| Suite | Result |
|-------|--------|
| On-chain code probes | Core contracts OK |
| `check:testnet-deployment` | PASS after optional Locker handling |
| Full user E2E (ICO buy / stake / claim) | **NOT YET RUN** |

---

## Remaining blockers / follow-ups

1. Deploy Community Governance when members are ready (`deploy:governance:testnet`).  
2. Create Pancake RACE/TEST-USDT pair + liquidity, then LiquidityLocker.  
3. Run E2E smoke (tiny ICO purchase, stake, claim).  
4. Wire Laravel/React to these Testnet addresses.  
5. Do **not** treat this as production ready.

---

```
CORE DEPLOYMENT:
COMPLETE

POST-DEPLOY CONFIGURATION:
COMPLETE

ORACLE:
PASS

OWNERSHIP HARDENING:
PASS

END-TO-END TEST:
NOT YET RUN

MAINNET:
NOT EXECUTED
```
