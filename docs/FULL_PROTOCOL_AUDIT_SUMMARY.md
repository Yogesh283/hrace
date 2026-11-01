# Full Protocol Audit — Executive Summary

**Project:** Rynexcapital / Race Network  
**Audit date:** 2026-09-14  
**Scope:** Testnet-first, mainnet-protected, **read-only audit** (no code/deploy changes performed)  
**Manifest:** `contracts/deployments/bscTestnet/deployment.json` (chain **97**)

---

## 1. Executive summary

The codebase combines **BSC Testnet smart contracts** (RaceCoin, RaceICO, RaceCommunityEngine, RewardVault, Oracle, MultiSig, treasuries) with a **Laravel + Inertia/React** platform (virtual income wallet, withdrawals, indexing, admin). **Solidity unit/integration tests are strong (132/132 passing).** Laravel tests are **mostly passing (92 pass, 6 fail, 16 skipped)** with failures tied to recent Virtual Income Wallet balance rules and unrelated profile/id tests.

**Live testnet** has a verified ICO purchase and indexed stake (`0xd6a8025c…`). **Critical gap:** repository **source** for `RaceCommunityEngine` includes **claimEnabled + 24h global cooldown**, but the **deployed** engine at `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` was **not redeployed** after that change (per deployment note and prior UAT). On-chain claim policy on testnet is therefore **not aligned with newest Solidity** until redeploy + `setClaimEnabled`.

**Virtual Income Wallet** (`income_wallet_transactions`) is implemented with idempotency and BCMath balance, but **compound confirm does not verify chain transactions on-server**, and **withdrawal request debits virtual balance without automatic reversal on admin reject** — reconciliation gaps.

**Mainnet:** Multiple guards refuse mainnet deploy/index when testnet flags set; default Laravel `BSC_CHAIN_ID` is **56** if unset — operational risk if production `.env` is wrong. **No mainnet execution performed in this audit.**

---

## 2. Contract inventory (summary)

| Contract | File | Classification | Testnet address (deployment.json) |
|----------|------|----------------|-----------------------------------|
| RaceCoin | `RaceCoin.sol` | **ACTIVE** | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| TestnetMockUSDT | `TestnetMockUSDT.sol` | **ACTIVE** (testnet only) | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| RaceICO | `RaceICO.sol` | **ACTIVE** | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| RaceCommunityEngine | `RaceCommunityEngine.sol` | **ACTIVE** (bytecode drift vs source) | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| RaceRewardVault | `RaceRewardVault.sol` | **ACTIVE** | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| RaceRewardPriceOracle | `RaceRewardPriceOracle.sol` | **ACTIVE** | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| RaceMultiSig | `RaceMultiSig.sol` | **ACTIVE** | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| RaceTreasury + dev/marketing/ops | `RaceTreasury.sol` | **ACTIVE** | see manifest |
| RaceGovernance | `RaceGovernance.sol` | **ACTIVE** (wallet-vote, separate from MultiSig) | deployed via governance script |
| RaceGovernor | `RaceGovernor.sol` | **LEGACY** (stake-weighted) | `0xD53De472E9363B5eA08BAF919955B6332575A85D` |
| RaceParticipation | `RaceParticipation.sol` | **LEGACY / parallel** | `0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5` |
| RaceStaking | `RaceStaking.sol` | **LEGACY** (Governor dependency) | `0xA31C053767034C86BaB132B53686AAb7898255A3` |
| RaceRewardPool | `RaceRewardPool.sol` | **DEPRECATED path** | `0x77116d2B7f00F17fdEA1E2076dBAEfD257E004C8` |
| RaceAutoLiquidity | `RaceAutoLiquidity.sol` | **ACTIVE** (LP tooling) | `0xafC443895FAb63F4221B50Cc9dceB46ce925F146` |
| RaceLiquidityLocker | `RaceLiquidityLocker.sol` | **UNUSED** on testnet | `null` |
| RaceVesting / EcosystemVault | various | **ACTIVE** (allocations) | see manifest |
| Mocks | `mocks/*` | **TEST ONLY** | n/a |

Full per-contract notes: `docs/FULL_PROTOCOL_AUDIT.md` §3.

---

## 3. RACE token audit (summary)

| Check | Result |
|-------|--------|
| Decimals | 18 (`RaceCoin.sol`) |
| MAX_SUPPLY | 150_000_000 ether — matches locked tokenomics rule |
| ICO cap (on-chain) | 600_000 RACE via `RaceICO.TOTAL_ALLOCATION` |
| Initial deploy mint | **1_000_000 RACE to owner** at constructor (separate from ICO bucket — document vs “600,000 ICO only” marketing) |
| Mint paths | `mint()` **onlyMinter**; `governanceMint()` **onlyGovernance** + 1%/month cap |
| MAX_SUPPLY enforcement | `require(totalSupply + amount <= MAX_SUPPLY)` on mint paths |
| Unauthorized mint | **No** — reverts `RaceCoin: not minter` / `not governance` |
| Testnet minters | ICO + Vault enabled in `linkages` |

**Evidence:** `contracts/src/RaceCoin.sol`, `contracts/test/*`, deployment `linkages.raceCoinMinterIco/Vault`.

---

## 4. ICO audit (summary)

**Flow (source):** USDT `transferFrom` → **`adminWallet`**; RACE `mint(engine)`; `openIcoStake` → stake index.

**Phases (code):** 200_000 RACE × 3 = **600_000 RACE**; USDT caps **$50k / $70k / $90k**; prices **$0.25 / $0.35 / $0.45** (`PHASE_ALLOCATION`, `phase*UsdtCap`, constructor math).

**Known tx:** `0xd6a8025c…` — DB: 1 USDT → 4 RACE, phase 1, stake index 0, 180D @ 50 bps — **consistent**.

---

## 5. CommunityEngine audit (summary)

**Rates (source `_dailyRateBps`):** Flexible = 35 bps (0.35%); 180D = 50 bps (0.50%); 365=70; 730=90; 1095=100 bps.

**Reward formula:** `principalUsdt × dailyRateBps × daysOwed / 10_000` (USDT-notional), RACE via oracle conversion on pay.

**MAX_REWARD_DAYS:** 30 on capped claim/compound paths; withdraw settlement can use uncapped path per comments.

**Claim policy (source):** `claimEnabled` + `icoCompleted()` (if wired) + **`lastSuccessfulClaimAt[user]` + 24h global** (not per-stake). **Deployed testnet instance:** **PARTIAL** — policy in repo tests; **live contract not verified upgraded in this audit run** (no on-chain `eth_call` to `claimEnabled` in audit script — inferred from deployment note + frontend safe-read pattern).

---

## 6. Claim audit (summary)

| Layer | Status |
|-------|--------|
| On-chain (new source) | PASS in **tests**; **FAIL/PARTIAL on live testnet** until redeploy |
| Laravel virtual claim | PASS in hybrid mode (`IncomeClaimService`, no admin fee) |
| Per-income mint | On-chain claim **does** mint RACE via vault (by design); Laravel accrual **does not** mint per cron tick |

---

## 7. Virtual Income Wallet audit (summary)

**Authority:** `VirtualIncomeWalletService` — sum(credits) − sum(debits), BCMath, idempotency keys.

**Mirror:** `LedgerWriter` → `income_wallet_transactions` for earned types; excludes deposits, accrual-only, explicit withdrawal mirror (withdrawal debited in `WithdrawalService`).

**Gaps (HIGH):** Rejected withdrawal **does not credit back** virtual debit; **no backfill** command for historical ledger; **dual balance** `user_wallets` vs virtual wallet for operations.

---

## 8. Compound audit (summary)

- Platform `CompoundStakeService`: debits virtual via ledger mirror — **PASS** in tests.
- On-chain `VirtualIncomeCompoundService`: **reserve debits**; **confirm only stores tx_hash** — **does not verify receipt/logs on-chain (HIGH)**.

---

## 9. Withdrawal audit (summary)

**Server:** `RewardPlan::calculateWalletWithdrawalFee` — Team 10% + Admin ($1 if gross&lt;$100 else 1%). **PASS** in tests.

**Virtual debit:** At **request** with idempotency — **PASS** for duplicate prevention; **FAIL** for reject reversal.

---

## 10. Oracle audit (summary)

Dedicated **`RaceRewardPriceOracle`** — not Pancake `getAmountsOut`. Staleness, bounds, deviation bps, updater ACL. **PASS** in contract tests. Owner on testnet → MultiSig per post-deploy txs.

---

## 11. Treasury / MultiSig audit (summary)

**RaceMultiSig:** immutable **5 signers, 3 confirmations**, replay protection via `executed` flag — matches deployment `multisigThreshold: "3"` and 5 addresses. **PASS** in `RaceMultiSig.test.js`.

---

## 12. Governance audit (summary)

- **RaceGovernance:** 10–12 wallet members, 1 wallet = 1 vote, timelock — **separate from MultiSig**.
- **RaceGovernor:** stake-weighted via `RaceStaking` — **legacy**; address on manifest but not primary path in Laravel UI.

**RaceCoin mint:** Governance mint capped; **owner** still controls minter mapping — expected centralization; not a bypass of MAX_SUPPLY.

---

## 13. Liquidity audit (summary)

Testnet Pancake router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` (manifest). `RaceAutoLiquidity` + locker present; locker **null** on testnet deploy. Trading price via Pancake **separate** from reward oracle — **PASS** by design in oracle comments.

---

## 14. Indexer audit (summary)

`BscJsonRpcClient` + `blockchain:index-events` — chain 97 guard, RPC fallbacks, chunked logs, cursor in `blockchain_index_state`.

**Known ICO tx:** 8 event rows; **4 decoded as `Unknown`** — **HIGH** (ABI/topic map gap).

**Reorg handling:** **None** explicit — **MEDIUM**.

---

## 15. Laravel audit (summary)

Virtual wallet services, withdrawal, claim, team rewards, ROI accrual — documented in `docs/VIRTUAL_INCOME_WALLET_ARCHITECTURE.md`.

**Mode split:** `REWARDS_ENGINE=blockchain_only` (common in `.env`) vs hybrid PHPUnit — production Laravel ROI/claim **disabled** when blockchain-only.

---

## 16. Frontend audit (summary)

`useWalletNetwork`, `Web3NetworkBanner`, engine reads prefer RPC — **PARTIAL PASS**. Isu/RaceToken on-chain reads; virtual income labeled on Investment/Withdrawal/VirtualIncomeWallet pages.

**Risk:** Stale built assets if `npm run build` not run after config changes — **LOW**.

---

## 17. Database audit (summary)

Dual/triple truth: `ledger_entries`, `user_wallets`, `income_wallet_transactions`, `blockchain_events`, `blockchain_engine_stakes`, `ico_purchases`. Legacy `ico_stakes` discouraged in verify scripts — **MEDIUM** legacy table risk if still populated.

---

## 18. Admin / security audit (summary)

Orchid admin for withdrawals, income jobs, users. No evidence of arbitrary virtual balance edit endpoint in audit sample — ledger writes go through services. On-chain admin actions require **MultiSig** after hardening txs.

---

## 19. Mainnet safety audit (summary)

- `deploy.js` refuses testnet with mainnet USDT/router.
- `IndexBlockchainEventsCommand` refuses chain 56 when `CONFIRM_TESTNET_DEPLOYMENT` set.
- `npm run deploy:mainnet` **blocked** in package.json.
- Default `config('blockchain.chain_id', 56)` — **HIGH** if misconfigured `.env`.

**Mainnet USDT** `0x55d398…` referenced only in guards/docs — **not** used when chain=97 configured correctly.

---

## 20. Test results

| Suite | Result |
|-------|--------|
| Hardhat (`contracts/`) | **132 PASS** |
| PHPUnit (full) | **92 PASS, 6 FAIL, 16 SKIP** |
| Frontend automated | **NOT RUN** (no Vitest suite observed) |

**Failed PHPUnit:** `BuiltForGrowthDurationTest`, `IdActivationTest`, `ProfileTest`, `WithdrawalRateLimitTest` (×3) — virtual wallet funding / unrelated.

---

## 21. Known testnet state

| Item | Value |
|------|--------|
| ICO tx | `0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8` |
| Purchase | 1 TEST-USDT → 4 RACE, 180D, stake #0 |
| User mapping | Laravel user **#72**, wallet `0xB836…E984` |
| Indexer | `ICOStakeCreated`, `ICOPurchased`, `ParticipationPurchased` + 4 Unknown |

---

## 22–26. Findings counts

| Severity | Count |
|----------|------:|
| **CRITICAL** | 2 |
| **HIGH** | 9 |
| **MEDIUM** | 14 |
| **LOW** | 12 |
| **INFO** | 10 |

### Critical findings

1. **Live testnet Engine bytecode vs claim policy source** — new gates may be absent on `0xc0D9…` until redeploy (`docs/CLAIM_ACTIVATION_24H_POLICY.md` vs deployment note).
2. **Virtual compound `confirmOnChain` does not verify blockchain transaction** — virtual debit can finalize without provable mint (`VirtualIncomeCompoundService.php`).

### High findings (top)

1. Withdrawal **virtual debit not reversed** on admin reject.  
2. Indexer **Unknown** events for known ICO tx (4/8).  
3. **Triple balance** reconciliation (`user_wallets`, `ledger_entries`, `income_wallet_transactions`).  
4. **`REWARDS_ENGINE=blockchain_only`** vs Laravel virtual income UX coexistence.  
5. **Legacy RaceParticipation** still deployed alongside Engine.  
6. PHPUnit regressions (6 failures).  
7. No on-chain verification step in compound confirm API.  
8. Default **chain_id 56** in config fallback.  
9. Frontend/on-chain claim policy reads **unsupported** on old engine (handled in JS, policy not enforceable on-chain).

*(Full lists in `docs/FULL_PROTOCOL_AUDIT.md`.)*

---

## Required final table

| Area | Status | Risk | Evidence |
|------|--------|------|----------|
| RaceCoin | **PASS** | LOW | `RaceCoin.sol`, 132 Solidity tests, MAX_SUPPLY checks |
| TestnetMockUSDT | **PASS** | LOW | Address `0xE30F…`, chainid 56 revert, 18 decimals |
| RaceICO | **PASS** | LOW | Purchase flow, caps, known tx reconciliation |
| CommunityEngine | **PARTIAL** | **HIGH** | Source/tests PASS; live deploy bytecode drift for claim |
| RewardVault | **PASS** | LOW | `onlyEngine`, mint via minter |
| Oracle | **PASS** | MEDIUM | Separate from Pancake; staleness/bounds in source |
| Treasury | **PASS** | LOW | MultiSig-owned post-deploy |
| MultiSig | **PASS** | LOW | 3-of-5 immutable, tests |
| Governance | **PARTIAL** | MEDIUM | Two systems (Governance vs Governor); Governor legacy |
| Liquidity | **PARTIAL** | MEDIUM | AutoLiquidity deployed; locker null testnet |
| Claim | **PARTIAL** | **HIGH** | On-chain policy not on live engine; Laravel claim OK |
| Virtual Income Wallet | **PARTIAL** | **HIGH** | Implemented; reject reversal + backfill gaps |
| Compound | **PARTIAL** | **HIGH** | Idempotent debit; weak on-chain confirm |
| Withdrawal | **PARTIAL** | **HIGH** | Fees PASS; virtual debit lifecycle incomplete |
| Team/Level Income | **PASS** | MEDIUM | `WithdrawalTeamRewardTest`, mirror to virtual wallet |
| Indexer | **PARTIAL** | **HIGH** | Known tx indexed; Unknown topics |
| Laravel | **PARTIAL** | MEDIUM | 92/98 pass; mode/env complexity |
| Frontend | **PARTIAL** | MEDIUM | Testnet wiring; engine ABI drift handled |
| Database | **PARTIAL** | MEDIUM | Multiple sources of truth |
| Admin | **PASS** | MEDIUM | Centralized payout approval by design |
| Mainnet Safety | **PARTIAL** | **HIGH** | Guards exist; default chain 56 if misconfigured |

---

## TESTNET_PROTOCOL_STATUS: **AMBER**

Core ICO + stake + indexing **work on testnet** with evidence tx. Claim policy on-chain, virtual wallet lifecycle, and indexer decoding **not fully green**.

## MAINNET_READINESS: **NO-GO**

## CRITICAL_FINDINGS: **2**

## HIGH_FINDINGS: **9**

## MEDIUM_FINDINGS: **14**

## LOW_FINDINGS: **12**

## TOP 10 FIXES REQUIRED (ordered)

1. Redeploy / upgrade **RaceCommunityEngine** on testnet OR document frozen bytecode; enable claim via MultiSig only after ICO complete.  
2. Implement **on-chain tx verification** for virtual compound confirm (or rollback debit on failure).  
3. **Credit virtual wallet** when withdrawal rejected/cancelled after request debit.  
4. Fix **indexer ABI/topic map** to eliminate `Unknown` for ICO/Engine events.  
5. Single **balance reconciliation** policy doc + admin tool (`user_wallets` vs virtual wallet).  
6. Align **REWARDS_ENGINE** UX: hide/disable Laravel claim when `blockchain_only`.  
7. Deprecate or firewall **RaceParticipation** in config/UI to prevent dual staking paths.  
8. Repair **PHPUnit** failures (virtual wallet test seeds).  
9. **Backfill** `income_wallet_transactions` from historical ledger (optional command).  
10. Enforce **BSC_CHAIN_ID=97** at boot on testnet deployments (fail-fast if 56 with test addresses).

---

*Detailed evidence, contract-by-contract inventory, and flow map: `docs/FULL_PROTOCOL_AUDIT.md`*
