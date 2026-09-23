# TESTNET E2E REPORT

**Date:** 2026-09-23  
**Network:** BSC Testnet only  
**MAINNET READY:** **NO**

---

# NETWORK
BSC Testnet — chainId **97**  
Preflight: **PASS** (`CONFIRM_TESTNET_DEPLOYMENT=YES`)  
Fresh full redeploy this session: **NOT RUN** (live ecosystem already present; deployer tBNB LOW ~0.186; Engine source sync needs `CONFIRM_ENGINE_REDEPLOY=YES`)

---

# CONTRACTS
**PASS** (core live + linkages OK)  
**PARTIAL:** Engine bytecode ≠ current repo compile  
**BLOCKED:** RaceIncomeVault, RaceLendingBorrowing, RaceLiquidityLocker, RaceGovernance  
**LEGACY (not active path):** RaceStaking, RaceRewardPool, RaceParticipation, old Engine

---

# CORE FLOW
USDT (TEST) → RACE mint → Engine stake — **PASS** (live ICO purchase UAT)

Evidence TX: `0xdd4ce12054074bc51d2b5b04f38b5652b4e61037bbcff6178368766057d41a0e`

---

# ICO
**PASS** (purchase + stake + Flexible rejected on ICO)  
Note: `USDT deducted` UAT check **FAIL** when buyer == `adminWallet` (self-transfer net zero) — payment still proven by soldRace / supply / stake.

`adminWallet` = `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984`

---

# REFERRAL
**NOT fully re-tested on live Engine this run**  
Live Engine bytecode older than repo (post-change “no N-directs” may be absent on-chain).  
Hardhat unit tests cover current source; live = **BLOCKED until Engine redeploy**.

---

# LEADERSHIP
**SKIP** on public testnet this run (needs funded team tree + time). Prior Hardhat coverage exists.

---

# FLEXIBLE EXIT
**PASS** gate: Flexible `participate` before ICO complete **reverts** as designed.  
Full withdraw path: **SKIP** (`icoCompleted=false`).

---

# FIXED MATURITY / EMI
**SKIP** on public BSC Testnet (use Hardhat time travel). Not faked on live chain.

---

# MULTISIG
**PASS** — threshold 3, 5 signers, non-signer submit blocked.

---

# TREASURY
**PASS** — RaceTreasury + expense funds Multisig-controlled; maturityTreasury locked to RaceTreasury.

---

# ORACLE
**PASS** (wired; owner MultiSig). Live claim accrual skipped (`claimEnabled=false` historically; 1-day wait not done).

---

# INCOME VAULT
**BLOCKED** — not deployed; `CONFIRM_INCOME_VAULT_DEPLOY` unset.  
Also: Withdrawal Admin Fee → `RaceICO.adminWallet` funding architecture still unresolved for Laravel path.

---

# LENDING
**BLOCKED** — `RaceLendingBorrowing` stores `racePositionNotional` only; does **not** allocate/stake RACE. Must not mark complete.

---

# LARAVEL INDEXER
**CONFIG PASS** — root `.env` already on chain 97 + live addresses.  
Indexer live cron not started in this session (ops: `blockchain:index-events`).

---

# CLIENT E2E
**PARTIAL** — automated UAT against MetaMask-compatible contracts (deployer wallet). Full MetaMask UI session not run in this agent session.

---

# SECURITY
**PASS** samples: unauthorized mint blocked; non-signer Multisig blocked; claim/compound before accrual blocked.  
Engine `distributeReward` auth probe **INCONCLUSIVE** while claim gates closed.

---

# MAINNET READINESS
**ALWAYS: NO**

---

## Concise tables

### Contracts

| Contract | Testnet Address | Owner | Status |
|----------|-----------------|-------|--------|
| TestnetMockUSDT | 0xE30F…8fEc | mint ops | PASS |
| RaceMultiSig | 0x6E04…c64a | 3-of-5 | PASS |
| RaceCoin | 0xbCAE…22e6 | MultiSig | PASS |
| RaceRewardVault | 0x44aB…6ca4 | MultiSig | PASS |
| RaceRewardPriceOracle | 0xB5A6…556a | MultiSig | PASS |
| RaceCommunityEngine | 0xbdDe…456ef | MultiSig | PASS* |
| RaceICO | 0x9C22…1C73 | MultiSig | PASS |
| RaceTreasury | 0x04F3…c93A | MultiSig | PASS |
| Expense funds (×3) | see inventory | MultiSig | PASS |
| RaceIncomeVault | — | — | BLOCKED |
| RaceLendingBorrowing | — | — | BLOCKED |
| RaceLiquidityLocker | — | — | NOT DEPLOYED |

\*Live OK; bytecode ≠ current repo.

### E2E tests

| E2E Test | Result | TX Hash / Evidence |
|----------|--------|--------------------|
| chainId 97 | PASS | preflight / UAT |
| Wiring vault/ico/oracle/treasury | PASS | verify-engine-testnet JSON |
| MultiSig 3-of-5 | PASS | threshold=3; non-signer revert |
| TEST-USDT mint/approve | PASS | approve `0x3e218d69…` |
| ICO purchase → stake | PASS | `0xdd4ce120…` |
| ICO Flexible rejected | PASS | revert |
| FLEX before ICO complete | PASS | revert `flexible after ico only` |
| Claim before accrual | PASS | revert |
| Live 1d claim/compound | SKIP | public chain / claimEnabled |
| Maturity + EMI | SKIP | Hardhat only |
| Engine = current source | FAIL/BLOCKED | bytecode hash mismatch |
| Lending complete product | BLOCKED | no RACE stake |
| IncomeVault | BLOCKED | not deployed |

---

## Totals

| Metric | Count |
|--------|-------|
| TOTAL CONTRACTS DEPLOYED (active+legacy on-chain) | 18+ (see inventory) |
| NEW DEPLOYS THIS SESSION | 0 |
| UAT ASSERTIONS (this run) | ~40 |
| PASS | majority config + ICO path |
| FAIL | 1 (USDT balance delta when buyer==admin) |
| SKIP | claim/compound accrual, maturity, locker, gov |
| BLOCKED | Engine source sync, IncomeVault, Lending, LiquidityLocker |
| **MAINNET READY** | **NO** |

---

## Unblock checklist (next ops)

1. Fund deployer ≥ **0.30 tBNB**  
2. Set `CONFIRM_ENGINE_REDEPLOY=YES`  
3. `npm run redeploy:engine-c1-testnet` (relink vault+ICO via Multisig)  
4. Update Laravel `RACE_COMMUNITY_ENGINE_CONTRACT`  
5. Optionally deploy LiquidityLocker after LP; IncomeVault only with funded architecture + fee → `RaceICO.adminWallet()`  
6. Do **not** deploy Lending as complete until RACE stake allocation exists  
7. Re-run `npm run uat:testnet-e2e` + MetaMask client checklist
