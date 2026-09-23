# Full Protocol Audit — Rynexcapital / Race Network

**Type:** Read-only master audit (no code changes, no deploy, no mainnet execution)  
**Date:** 2026-09-14  
**Primary manifest:** `contracts/deployments/bscTestnet/deployment.json`  
**Chain:** BSC Testnet **97**

---

## 0. Methodology

Compared: Solidity sources, Hardhat tests, `deployment.json`, Laravel `config/*`, services/controllers, migrations, Inertia pages, `docs/*`, and live DB verification scripts (`scripts/verify-known-ico-tx.php`, `scripts/verify-ico-stake-display.php`).

When docs and code disagree, **both are reported** (see § Discrepancies).

---

## 1. Pre-change impact list (architecture)

See also `docs/VIRTUAL_INCOME_WALLET_ARCHITECTURE.md`, `docs/CLAIM_VIRTUAL_INCOME_WITHDRAWAL_POLICY.md`, `docs/CLAIM_ACTIVATION_24H_POLICY.md`.

---

## 2. Contract inventory (complete)

### 2.1 Active production path (testnet)

| File | Contract | Purpose | Proxy | Owner (manifest) |
|------|----------|---------|-------|------------------|
| `RaceCoin.sol` | RaceCoin | BEP20 RACE, fees, minters | No | MultiSig |
| `TestnetMockUSDT.sol` | TestnetMockUSDT | Test USDT 18dp | No | deployer/faucet |
| `RaceICO.sol` | RaceICO | 3-phase ICO, 600k RACE cap | No | MultiSig |
| `RaceCommunityEngine.sol` | RaceCommunityEngine | Participation, ICO stakes, claim/compound/EMI | No | MultiSig |
| `RaceRewardVault.sol` | RaceRewardVault | Engine-only mint pay | No | MultiSig |
| `RaceRewardPriceOracle.sol` | RaceRewardPriceOracle | Reward USDT/RACE price | No | MultiSig |
| `RaceMultiSig.sol` | RaceMultiSig | 3-of-5 exec | No | n/a |
| `RaceTreasury.sol` | RaceTreasury | Fee/treasury sink | No | MultiSig |
| `RaceAutoLiquidity.sol` | RaceAutoLiquidity | LP automation | No | deploy/MultiSig |
| `RaceEcosystemVault.sol` | RaceEcosystemVault | Ecosystem bucket | No | per deploy |
| `RaceVesting.sol` | RaceVesting | Vesting schedules | No | per deploy |
| `RaceGovernance.sol` | RaceGovernance | Wallet-vote governance | No | per deploy |

### 2.2 Legacy / parallel / deprecated

| File | Contract | Classification | Risk |
|------|----------|----------------|------|
| `RaceParticipation.sol` | RaceParticipation | **LEGACY** — still in deployment.json | Users could use old ABI if UI exposes it |
| `RaceStaking.sol` | RaceStaking | **LEGACY** — Governor stake-weight | Governor dependency |
| `RaceGovernor.sol` | RaceGovernor | **LEGACY** — stake-weighted DAO | Differs from RaceGovernance model |
| `RaceRewardPool.sol` | RaceRewardPool | **DEPRECATED** income pool pattern | Wired address exists |
| `RaceLiquidityLocker.sol` | RaceLiquidityLocker | **UNUSED** on testnet (`null`) | — |
| `mocks/*` | Mocks | **TEST ONLY** | Must not deploy to mainnet as prod |

### 2.3 Cross-cutting security (all contracts)

- Solidity **0.8.20** — overflow checks on by default.
- **ReentrancyGuard** on financial contracts (Engine, Vault, ICO, MultiSig, etc.).
- **Access control:** Ownable → MultiSig on testnet post-deploy (`postDeployTxs` in manifest).
- **No upgrade proxies** observed in `contracts/src`.

---

## 3. RaceCoin — detailed

**File:** `contracts/src/RaceCoin.sol`

| Item | Value |
|------|--------|
| Decimals | 18 |
| MAX_SUPPLY | 150_000_000 × 1e18 |
| INITIAL_MINT | 1_000_000 × 1e18 to owner at deploy |
| Transfer fee | 4% (400 bps) with exemptions |
| Minter mint | `mint(to, amount)` — `onlyMinter`, cap check |
| Governance mint | `governanceMint` — 1% MAX_SUPPLY per month |

**Mint paths:** Authorized minters (ICO, Vault); governance; no public mint.

**Security answer:** Unauthorized actors **cannot** mint (reverts).

**Locked tokenomics note:** Workspace rule cites ICO **600,000 RACE** — matches `RaceICO.TOTAL_ALLOCATION`. Initial **1M** circulating mint to owner is **additional** on-chain allocation (INFO — ensure disclosure aligns with locked marketing).

**Testnet:** `raceCoinMinterIco` + `raceCoinMinterVault` true in manifest.

---

## 4. TestnetMockUSDT

**Address (required):** `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` — **matches** `deployment.json`.

| Check | Result |
|-------|--------|
| Decimals | 18 |
| Mint | `onlyOwner` |
| Mainnet | `MainnetForbidden` if `chainid == 56` |
| Symbol/name | TEST-USDT (not official USDT) |

**Production misuse:** Laravel `VerifyBlockchainTestnetCommand` compares USDT/router against mainnet constants when chain=97 — **PASS** if command run in CI.

---

## 5. ICO — detailed trace

```
User → approve USDT → RaceICO.purchase(usdt, lock)
  → USDT.safeTransferFrom(user, adminWallet)
  → raceToken.mint(engine, raceOut)
  → engine.openIcoStake(buyer, usdt, race, lock, purchaseId)
```

**Phase economics (code):**

| Phase | RACE allocation | USDT cap | Price |
|------:|----------------:|---------:|------:|
| 1 | 200_000 | $50_000 | $0.25 |
| 2 | 200_000 | $70_000 | $0.35 |
| 3 | 200_000 | $90_000 | $0.45 |
| **Total** | **600_000** | **$210_000** | — |

**USDT destination:** `adminWallet` (not staking contract) — **Evidence:** `RaceICO.sol` ~500.

**Flexible ICO:** Rejected via `isValidStakePlan` (fixed locks only).

**Reentrancy:** `nonReentrant` on purchase.

---

## 6. RaceCommunityEngine — detailed

**Rates (`_dailyRateBps`):** 0→50; 180→50; 365→70; 730→90; 1095→100 bps.

**Formula:** `rewardUsdt = principalUsdt * dailyRateBps * daysOwed / 10_000` (then oracle → RACE mint via vault).

**MAX_REWARD_DAYS:** 30 on standard claim accrual window.

### Claim policy (source code)

| Gate | Mechanism |
|------|-----------|
| ICO complete | `icoContract.icoCompleted()` when wired |
| Admin gate | `claimEnabled == true` via `setClaimEnabled` (owner) |
| Cooldown | **`lastSuccessfulClaimAt[user]` + 24 hours** — **per user, global** (not per stake) |
| Failed claim | Cooldown timestamp updated only on **successful** claim (`ClaimCooldownRecorded`) |

**Deployed testnet engine (`0xc0D9…`):** Repository tests cover new selectors; deployment.json **does not** record post-deploy engine upgrade. Prior project notes state **live bytecode lacks new claim ABI**. **Status: PARTIAL / HIGH** until verified on-chain or redeployed.

---

## 7. RewardVault

- `pay(to, amount)` — **`onlyEngine`**, `nonReentrant`.
- Mints via `IRaceMintable.mint` — no pull from user.
- Cannot mint unless RaceCoin marks vault as minter — **PASS**.

---

## 8. Oracle

- **Not** Pancake price — explicit in contract header.
- `updatePrice` — updater ACL + bounds + deviation + staleness on read.
- Testnet owner transferred to MultiSig; updater was deployer pre-transfer.

---

## 9. Treasury + MultiSig

**MultiSig:** `REQUIRED = 3`, `SIGNER_COUNT = 5`, immutable signers — **matches** manifest.

**Limitation (by design):** No signer rotation without new contract — documented in MultiSig tests.

---

## 10. Governance (two systems)

| | RaceGovernance | RaceGovernor |
|---|----------------|--------------|
| Model | 10–12 wallets, 1 vote each | Stake-weighted |
| Timelock | Yes | 1 day delay |
| Status | Intended community path | Legacy / deployed address |
| RaceCoin mint | Via governed targets only | Not direct mint |

**Critical check:** No single EOA mint after ownership transfer — **PASS** in MultiSig tests.

---

## 11. Legacy contracts

| Address (testnet) | Contract | Wired in Laravel? |
|-------------------|----------|-------------------|
| `0x9BF2…` | RaceParticipation | Config `participation_contract` possible |
| `0x7711…` | RaceRewardPool | Low UI exposure |
| `0xD53D…` | RaceGovernor | Governance page payload |

**Risk:** Dual participation paths — **HIGH** operational confusion.

---

## 12. Liquidity / Pancake

- Testnet router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` (Pancake V2 testnet).
- `PancakePrice.sol` library used in participation/Engine contexts for **swap pricing**, not reward oracle.
- `RaceLiquidityLocker`: not deployed on testnet.

---

## 13. Virtual Income Wallet

**Tables:** `income_wallet_transactions` (migration `2026_09_14_140000_*`).

**Service:** `VirtualIncomeWalletService` — BCMath balance, idempotency, row locking via user lock.

**Credits mirrored from ledger types** (config `virtual_income_wallet.ledger_type_map`):

- Daily/monthly ROI → via **`income_claim`** after claim (accrual excluded).
- Team/level/referral types → mirrored on `LedgerWriter.record`.

**Deposits:** Excluded from mirror — **PASS**.

**Issues:**

| ID | Severity | Finding |
|----|----------|---------|
| VI-1 | HIGH | Withdrawal request debits virtual wallet; **`reject()` does not credit back** |
| VI-2 | HIGH | Compound confirm stores `tx_hash` without RPC verification |
| VI-3 | MEDIUM | No automated reconciliation job between `ledger_entries` and virtual table |
| VI-4 | MEDIUM | Historical rows pre-migration not mirrored unless backfill |

---

## 14. Claim → virtual wallet

1. `income:pay-roi` → accrual bucket (no virtual credit) — **PASS**.
2. `POST /income/claim` → ledger + mirror — **no admin fee** — **PASS** (tests).
3. **No RACE mint** on Laravel claim — **PASS**.

**Waiting multiple days:** Pay-roi loop accrues multiple days in one run — **PASS** in tests.

---

## 15. Compound

**Platform:** `CompoundStakeService` — debits virtual balance — tests updated.

**On-chain API:** `VirtualIncomeCompoundController` + `VirtualIncomeCompoundService`:

- `reserve` — idempotent debit — **PASS**.
- `confirm` — metadata only — **FAIL** vs requirement for authorized mint proof — **HIGH**.

---

## 16. Withdrawal

**Fee math:** Documented in `WithdrawalService` + `RewardPlan` — examples $50/$99/$100/$500 — **PASS** in tests.

**Application point:** Request time virtual debit + fee ledger on request/approve — Admin fee **not** on claim — **PASS**.

**Duplicate request:** Idempotency key on virtual debit — **PASS**.

**Reject path:** No virtual credit reversal — **HIGH**.

---

## 17. Team / level / referral

**Withdrawal team reward:** 10% pool, L1–L10 weights from `config/reward_plan.php` — **server-side only** — **PASS** (`WithdrawalTeamRewardTest`).

**Network ROI:** Triggered on ROI accrual entry type — now `roi_accrual` in cron — verify uplines still paid — **PASS** in `AffiliateNetworkRoiTest`.

**Virtual mirror:** Team reward credits mirror to `team_income` — **PASS**.

---

## 18. Database

**Key tables:**

| Table | Role |
|-------|------|
| `users` | Auth + `wallet_address` + `last_income_claim_at` |
| `user_wallets` | Legacy USDT balance |
| `ledger_entries` | Full audit trail |
| `income_wallet_transactions` | Virtual income authority |
| `ico_purchases` | ICO index |
| `blockchain_events` | Raw logs |
| `blockchain_engine_stakes` | Engine stake read model |
| `withdrawals` | Payout queue |

**Issues:** Duplicate truth (see VI-3); `ico_stakes` legacy — verify scripts say **LEGACY_ICO_STAKES_USED: NO**.

---

## 19. Indexer

**Files:** `BscJsonRpcClient.php`, `IndexBlockchainEventsCommand.php`, `BlockchainEngineStakeIndexer.php`.

| Feature | Status |
|---------|--------|
| chainId 97 check | PASS |
| RPC fallbacks | PASS (config) |
| log chunking | PASS |
| Cursor resume | `blockchain_index_state` |
| Reorg | **Not implemented** — MEDIUM |
| Duplicate prevention | DB inserts per tx/log — verify unique indexes |

**Known tx reconciliation (executed during audit):**

- 8 `blockchain_events` rows
- Named: `ICOStakeCreated`, `ParticipationPurchased`, `ICOPurchased`, `RaceMintedToStaking`
- **4 × `Unknown`** — HIGH

---

## 20. User → wallet mapping

Verified script output: **USER_WALLET_MAPPING: PASS** for tx `0xd6a8025c…` → user 72.

Pages scoped by authenticated user + `wallet_address`:

- `/ico` (IsuController) — indexed + RPC fallback
- `/investment` — engine stakes + platform investments
- `/virtual-income` — user_id scoped
- `/withdrawal` — user_id scoped

---

## 21. Frontend

| Component | Notes |
|-----------|--------|
| `useWalletNetwork.js` | Chain 97 expected |
| `web3Engine.js` | RPC-first reads; claim policy safe defaults |
| `Isu.jsx` | On-chain ICO + stakes |
| `VirtualIncomeWallet.jsx` | Unified balance UI |
| `Dashboard.jsx` | Default chain fallback 56 in one prop — LOW |

**Mainnet addresses in UI defaults:** Some pages default `chain_id: 56` in props — overridden by Inertia shared `blockchain` when configured — **MEDIUM** if SSR props missing.

---

## 22. Admin panel (Orchid)

Screens for withdrawals, income jobs, user wallets, blockchain data.

**Financial authority:** Withdrawal approve triggers ledger debit — not arbitrary virtual credit without ledger (no Orchid “set balance” found in audit grep sample).

---

## 23. Security checklist (selected)

| Threat | Assessment |
|--------|------------|
| Reentrancy | Mitigated on core contracts |
| Unauthorized RACE mint | **Protected** |
| Duplicate withdrawal (virtual) | Idempotency — **PASS** |
| Duplicate compound reserve | Idempotency — **PASS** |
| Double mint on compound retry | **Not fully prevented** off-chain confirm |
| Oracle stale/zero | Reverts on read in oracle |
| Self-referral | Laravel referral rules — not re-audited exhaustively — MEDIUM |
| DB race | Transactions + `lockForUpdate` on user in virtual wallet — **PASS** |

---

## 24. Mainnet safety

| Guard | Location |
|-------|----------|
| Refuse mainnet USDT on testnet deploy | `contracts/scripts/deploy.js` |
| `deploy:mainnet` blocked | `contracts/package.json` |
| Indexer refuses 56 + test flag | `IndexBlockchainEventsCommand` |
| TestnetMockUSDT chainid 56 revert | contract constructor |

**Dangerous path:** Laravel starts with `BSC_CHAIN_ID` unset → **56** — **HIGH** misconfiguration risk.

---

## 25. Secrets / environment

| Item | Status |
|------|--------|
| Root `.env` | **NOT FOUND** in git (`git ls-files` empty) — **PASS** |
| `contracts/.env` | **NOT FOUND** in git — **PASS** |
| Private keys in docs | References only; scripts claim “never print” — **PASS** |
| `.env.example` | Placeholder keys only — **PASS** |

**Note:** Local untracked `.env` may exist on developer machines — not audited for contents (values not printed).

---

## 26. Tests

### Solidity

```
132 passing (Hardhat)
```

Includes: RaceMultiSig, ICO, Engine claim policy, financial safety, TestnetMockUSDT.

### Laravel

```
92 passed, 6 failed, 16 skipped
```

Failures:

- `BuiltForGrowthDurationTest` — ROI percent expectation vs config
- `IdActivationTest` — activation null
- `ProfileTest` — delete account redirect/message
- `WithdrawalRateLimitTest` (3) — insufficient virtual wallet (needs virtual seed)

### Frontend

No automated test run — **NOT TESTABLE** in this audit run.

---

## 27. Live testnet reconciliation

| Field | On-chain / DB |
|-------|----------------|
| USDT | 1.0 |
| RACE | 4.0 |
| Phase | 1 @ $0.25 |
| Lock | 180D, 50 bps |
| Stake index | 0 |
| Block | 130724727 |

**Engine principal/staked:** Matches ICO purchase — **PASS**.

---

## 28. Business flow map

```
Registration/Login          → PASS
Wallet connect              → PASS (testnet)
TEST-USDT mint              → PASS (owner mint)
ICO purchase                → PASS (known tx)
RACE mint                   → PASS (to engine/stake path)
CommunityEngine stake       → PASS (indexed)
ICO completion              → UNKNOWN (phase status not re-verified on-chain in audit)
Claim activation            → PARTIAL (source yes; live engine redeploy pending)
Daily claim (on-chain)      → PARTIAL (engine policy / bytecode)
Daily claim (Laravel)       → PARTIAL (blockchain_only mode off in tests only)
Virtual Income Wallet       → PASS (hybrid mode)
Compound (virtual→chain)    → PARTIAL (confirm verification missing)
Withdraw                    → PARTIAL (fees OK; reject reversal missing)
Admin Fee on payout         → PASS (server-side)
Payout                      → PARTIAL (manual admin approval)
```

---

## 29. Documentation vs implementation discrepancies

| Topic | Doc | Code | Report |
|-------|-----|------|--------|
| ICO total | 600k RACE | 600k | **Match** |
| Claim cooldown scope | “24h per user” discussed | Global per user in Engine | **Match** (source) |
| Live engine claim gates | CLAIM_ACTIVATION doc | Deployed 0xc0D9… | **Mismatch until redeploy** |
| Initial RACE circulate | Locked rules emphasize ICO 600k | 1M INITIAL_MINT to owner | **Disclosure gap (INFO)** |
| Virtual wallet authority | New architecture doc | Implemented + mirror | **Match** with reconciliation gaps |
| REWARDS_ENGINE | Some docs say blockchain_only for testnet | `.env` often blockchain_only | Laravel virtual path **inactive** in prod env — **Mismatch UX** |

---

## 30. Finding register (condensed)

### CRITICAL (2)

- **C-1:** Testnet deployed Engine may lack claim policy bytecode vs current `RaceCommunityEngine.sol`.
- **C-2:** Virtual compound confirm lacks on-chain verification; virtual funds can be debited without proven mint.

### HIGH (9)

- H-1: Virtual withdrawal debit not reversed on reject.
- H-2: Indexer Unknown events (4/8 on known ICO tx).
- H-3: Triple balance sources without reconciliation job.
- H-4: blockchain_only vs hybrid Laravel income split.
- H-5: Legacy RaceParticipation still deployed.
- H-6: PHPUnit failures (6).
- H-7: Compound API confirm trust model.
- H-8: Default chain_id 56 in config.
- H-9: On-chain claim enforcement absent on old engine.

*(Medium/Low/Info findings enumerated in SUMMARY.)*

---

## 31. Audit constraints observed

- **No** Solidity/Laravel/React modifications.
- **No** deploy or mainnet transactions.
- **No** secret values printed.

---

*End of full audit report. Executive summary and GO/NO-GO: `docs/FULL_PROTOCOL_AUDIT_SUMMARY.md`*
