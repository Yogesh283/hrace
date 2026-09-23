# RACE / Rynexcapital — Full A-to-Z Master Audit Report

**Audit type:** Read-only production readiness / financial / security / smart contract / admin / governance / income / user flow  
**Project:** `C:\xampp\htdocs\Rynexcapital`  
**Date:** 2026-09-21  
**Source priority:** Solidity → Laravel → DB → Frontend → Tests → Config → Docs  

```
AUDIT_STATUS=COMPLETE_READ_ONLY
CRITICAL_OPEN=4
HIGH_OPEN=8
MEDIUM_OPEN=12
LOW_OPEN=10
```

```
MAINNET_READY=NO
TESTNET_READY=PARTIAL
```

| Section flag | Result |
|--------------|--------|
| USER_FLOW_AUDIT | PASS_WITH_GAPS |
| INCOME_AUDIT | PASS_HYBRID |
| DIRECT_INCOME_AUDIT | PASS |
| TEAM_INCOME_AUDIT | PASS |
| LEVEL_INCOME_AUDIT | PASS |
| RACE_AUDIT | PASS_WITH_TOKENOMICS_GAPS |
| USDT_AUDIT | PASS |
| STAKING_AUDIT | PASS_ENGINE_PRIMARY |
| ICO_AUDIT | PASS |
| CLAIM_AUDIT | PASS |
| COMPOUND_AUDIT | PASS_HYBRID |
| WITHDRAWAL_AUDIT | PASS |
| MATURITY_AUDIT | PASS |
| FLEXIBLE_AUDIT | PASS |
| LENDING_AUDIT | PASS_CODE_CONTRADICTIONS |
| TREASURY_AUDIT | PASS |
| MULTISIG_AUDIT | PASS |
| RACECOIN_AUDIT | PASS |
| REWARDVAULT_AUDIT | PASS |
| ORACLE_AUDIT | PASS |
| GOVERNANCE_AUDIT | PASS_LEGACY_PARALLEL |
| ADMIN_POWER_AUDIT | PASS_HIGH_RISK_PANEL |
| SECURITY_AUDIT | PASS_WITH_FINDINGS |
| DECENTRALIZATION_AUDIT | HYBRID |
| DATABASE_BLOCKCHAIN_AUDIT | PASS |
| DEPLOYMENT_AUDIT | TESTNET_ONLY |
| TEST_AUDIT | PHPUNIT_PASS_HARDHAT_PARTIAL_FAIL |
| FINANCIAL_RECONCILIATION | PASS_WITH_CENTRALIZED_RESIDUAL |

---

## 0. Executive summary

Rynexcapital is a **HYBRID** platform: **on-chain** RACE staking, ICO, engine claims/compounds, and reward minting via `RaceRewardVault`; **off-chain authoritative** USDT-notional virtual income, ROI accrual, leadership, referrals, and withdrawals in Laravel (`ledger_entries`, `income_wallet_transactions`) unless `INCOME_VAULT_AUTHORITATIVE` or `blockchain_only` flags are enabled.

**Testnet (BSC 97):** Core stack deployed per `contracts/deployments/bscTestnet/deployment.json`. **Not deployed on manifest:** `RaceIncomeVault`, `RaceLendingBorrowing`. **Mainnet manifest:** NOT_FOUND.

**Do not treat documentation alone as PASS** — several docs describe lending RACE auto-stake; **Solidity does not implement RACE mint/stake for lending** (notional field only).

---

## 1. PROJECT_COMPONENT_MAP (abbreviated — full inventory)

| Component | Path | Purpose | Authority | Financial impact | Chain impact | Status |
|-----------|------|---------|-----------|------------------|--------------|--------|
| Member app (Inertia) | `resources/js`, `routes/web.php` | UI | User session | Indirect | Wallet txs | ACTIVE |
| Wallet auth | `WalletAuthController`, `WalletAuthService` | SIWE-style login/register | Laravel session | None | Signature | ACTIVE |
| Virtual income | `VirtualIncomeWalletService` | Withdrawable USDT balance | **DB** (default) | **High** | Read if vault auth | ACTIVE |
| Ledger | `LedgerWriter`, `LedgerEntry` | Audit + legacy wallet | **DB** | **High** | Mirror only | ACTIVE |
| ROI cron | `IncomePayRoiCommand` | Daily accrual | **DB** | **High** | Skip if on-chain participation | ACTIVE |
| Leadership cron | `IncomePayCommunityLeadershipCommand` | Rank payouts | **DB** | **High** | None | ACTIVE |
| Referrals | `IncomeDispatcher` | L1–L10 stake bonuses | **DB** | Medium | None | ACTIVE |
| Level ROI share | `AffiliateNetworkRoiService` | 10% of ROI to L1 | **DB** | Medium | None | ACTIVE |
| Team on withdraw | `AffiliateTeamRewardsService` | 10% pool L1–L10 | **DB** | Medium | None | ACTIVE |
| Withdrawals | `WithdrawalService` | Approve/reject payout | **DB** | **High** | None | ACTIVE |
| Engine (chain) | `RaceCommunityEngine.sol` | Stake/claim/compound | **Chain** | **High** | **Primary** | ACTIVE testnet |
| ICO | `RaceICO.sol` | USDT→admin, mint→engine | **Chain** | **High** | **Primary** | ACTIVE testnet |
| Reward vault | `RaceRewardVault.sol` | Mint RACE to users | **Chain** | **High** | Mint | ACTIVE |
| Income vault | `RaceIncomeVault.sol` | USDT income ledger | **Chain** (if deployed) | High | UNVERIFIED deploy | CODE_ONLY |
| Lending | `RaceLendingBorrowing.sol` | USDT lending | **Chain** (if deployed) | Medium | NOT_DEPLOYED | CODE_ONLY |
| Lending block | `LendingUserAccessService` | App-level gate | **Laravel** | None on chain | None | ACTIVE |
| Indexer | `IndexBlockchainEventsCommand`, `IncomeVaultIndexer` | Event ingest | **DB read model** | Reconcile | Index | ACTIVE if enabled |
| Orchid admin | `app/Orchid` | Ops panel | **Admin RBAC** | **High if misused** | Config | ACTIVE |
| MultiSig | `RaceMultiSig.sol` | 3-of-5 execution | **Chain** | Treasury/outflows | **High** | ACTIVE testnet |
| Governance | `RaceGovernance.sol`, `RaceGovernor.sol` | Proposals | **Chain** | Configurable | Medium | DEPLOYED governor |

---

## 2. User registration audit

**Flow (code):** `GET /register` → `POST wallet-auth/nonce` (action register + `join_code`) → sign message → `POST wallet-auth/register` → user row with `wallet_address`, `referred_by` from join code.

| Question | Answer (evidence) |
|----------|-------------------|
| Register without wallet? | **No** for completion — register requires signed wallet (`WalletAuthController`) |
| Change wallet? | **Blocked** if already set — connect endpoints require empty wallet; login binds existing |
| Crypto verification? | **Yes** — nonce + `personal_sign`, nonce consumed from cache |
| Attach another wallet to existing user? | **No** (relocate blocked when address set) |
| Duplicate wallets? | **Prevented** — unique check `LOWER(wallet_address)` on register |
| Change referral/sponsor? | **Not exposed** to user post-register in auth flow |
| Admin modify? | **Yes** — `UserEditScreen`, team tools, full data screens (`platform.data`, `platform.systems.users`) |
| Audit trail | **Partial** — lending block has `lending_admin_actions`; referral/wallet admin edits **NOT_FOUND** dedicated immutable log |

**Example trace USER A:** Register with 8-char join code → wallet verified → optional deposit (`LedgerEntry` / on-chain verify) → investment (`InvestmentController` / engine index) → ROI accrual (`roi_accrual`) → claim (`IncomeClaimService` → `income_claim`) → compound (virtual reserve + on-chain verify) → withdrawal (`WithdrawalService` debits virtual wallet).

---

## 3. WALLET_AUTHORITY_MATRIX

| Wallet concept | Controller | Key dependency | Withdraw | Deposit purpose |
|----------------|------------|----------------|----------|-----------------|
| User connected wallet | User row | User key | N/A | Identity, chain txs |
| `user_wallets.balance_usd` | Laravel | Admin/ledger | Legacy path | Legacy USDT ledger |
| Virtual income | `income_wallet_transactions` | Laravel crons/admin | `WithdrawalService` | Platform income USDT-notional |
| On-chain income balance | `on_chain_income_balances` | Indexer | Vault contract (if deployed) | Future authoritative |
| RaceTreasury | `RaceTreasury.sol` | MultiSig | MultiSig only | RACE fees/maturity fee |
| Ops/Dev/Marketing treasury | `RaceMultisigFund` | MultiSig | MultiSig only | USDT/RACE ops |
| ICO admin wallet | `RaceICO.adminWallet` | ICO owner config | ICO owner sweeps | ICO USDT intake |
| Income vault liquidity pool | Env `INCOME_VAULT_LIQUIDITY_POOL` | EOA/contract | Vault `withdraw` pulls from pool | USDT payouts |
| Lending liquidity | `RaceLendingBorrowing` balance | Funders | Disburse to user | Loan principal USDT |
| Reward vault | Contract | Engine-only `pay` | Mint to users | RACE rewards |
| Settlement signer | Env pubkey | Off-chain key | Signs credits | Income vault |

---

## 4. User money flow (classification)

| Asset | Typical flow | Mode |
|-------|--------------|------|
| USDT | User → ICO adminWallet / Engine swap / Lending treasury deposit | ON-CHAIN |
| USDT | Cron income → virtual wallet → withdrawal approval | OFF-CHAIN (authoritative DB) |
| USDT | Income vault credit/withdraw (if deployed) | ON-CHAIN |
| RACE | ICO mint → Engine stake | ON-CHAIN |
| RACE | RewardVault mint on claim/referral/leadership | ON-CHAIN |
| RACE | Transfer 4% fee → treasury/pool/dev/LP | ON-CHAIN |
| RACE | Flexible `withdrawStake` fee → L1–L10 team on-chain | ON-CHAIN |

---

## 5. COMPLETE INCOME MATRIX (sources found in repo)

| Income name | Trigger | Formula (source) | Token | Destination | Authority | Ledger type |
|-------------|---------|------------------|-------|-------------|-----------|-------------|
| Daily ROI | `income:pay-roi` | `principal × daily%/100` | USDT-notional accrual | `investments.accrued_reward_usd` | DB | `roi_accrual` |
| ROI claim | User claim | Moves accrual → wallet | USDT-notional | Virtual wallet | DB | `income_claim` |
| Level / ROI sharing | After ROI accrual | 10% of ROI to L1 sponsor | USDT-notional | Virtual | DB | `affiliate_network_roi` |
| Community referral | New qualifying stake | L1 3%, L2–3 1%, L4 0.5%, L5–10 0.25% | USDT-notional | Virtual | DB | `community_referral` |
| Community leadership | Daily cron | Rank % × leg ROI / gap rules | USDT-notional | Virtual | DB | `community_leadership*` |
| Team reward | Withdrawal | 10% gross × L1–L10 weights | USDT-notional | Virtual | DB | `community_team_reward` |
| Engine daily reward | `claimReward` | days × principal × bps; oracle → RACE | RACE | User wallet | CHAIN | Events |
| Engine referral | Stake | BPS table in Engine | RACE | Upline | CHAIN | Events |
| Engine leadership | `distributeLeadershipForMember` | Team ROI × rank bps | RACE | User | CHAIN | Events |
| Engine flexible team fee | `withdrawStake` | 10% fee × weights 25…5 | RACE | Upline | CHAIN | Events |
| Stake unlock EMI | `income:release-stake-emis` | 10% admin + 3×30% EMIs | USDT-notional | Virtual | DB | `stake_unlock_emi` |
| Legacy types | Various | Bonza, R10, affiliate_* | USDT-notional | Virtual | DB | Multiple |
| Income vault credit | Signed settlement | Off-chain calc | USDT | Vault balance | CHAIN (if deployed) | Indexer |

**Duplicate protection:** Ledger meta keys, withdrawal status machine, vault `processedIncome` / `processedWithdrawals`, engine `_leadershipPaid`, lending charge bitmaps.

---

## 6. Direct income

**Primary “direct” mechanisms:**
1. **Community referral L1** — 3% of qualifying stake principal (`config/reward_plan.php`, `IncomeDispatcher`).
2. **Affiliate network ROI** — 10% of credited ROI to direct sponsor (`AffiliateNetworkRoiService`, `direct_roi_of_roi_percent`).

**Numerical example (Laravel ROI path, not on-chain engine):**  
If configured daily ROI on $1,000 principal is 0.50%/day → daily accrual **$5.00** (`IncomePayRoiCommand`). Level income to sponsor = **$0.50** (10% × $5). Values use repository formulas; tier % from `reward_plan.participation_tiers`.

**On-chain direct referral (Engine):** L1 **3%** of `principalUsdt` paid in RACE via vault on stake (`_communityReferralBps[0]=300` bps).

---

## 7. System / team / level income table

| Type | Qualification | % / weights | Receiver | DB | Contract |
|------|---------------|-------------|----------|-----|----------|
| Level income | L1 sponsor activated | 10% of ROI | Sponsor | `affiliate_network_roi` | N/A |
| Team income (withdraw) | L1–L10 uplines | 25,15,12,10,9,8,6,5,5,5 of **10% fee pool** | Uplines | `community_team_reward` | N/A |
| Engine team reward | Same weights | 10% of **RACE** withdrawn | Uplines | Indexer | `withdrawStake` |
| Leadership ranks 1–11 | Volume/direct rules | Per-rank bps | Leader | `community_leadership` | Engine + cron |

---

## 8. RACE income paths

| Path | Mint? | Minter |
|------|-------|--------|
| ICO | Yes | ICO → Engine (minter) |
| Claim/compound/referral/leadership | Yes | `RaceRewardVault.pay` → `RaceCoin.mint` |
| governanceMint | Yes | Owner/governance monthly cap 1% MAX_SUPPLY |
| INITIAL_MINT | Yes | Constructor 1M to deploy owner |
| Lending package RACE | **NOT_FOUND on-chain** | `racePositionNotional` only |

**MAX_SUPPLY:** `150_000_000 ether` in `RaceCoin.sol` — matches locked tokenomics rule.

---

## 9. USDT classification

| Usage | Meaning in code |
|-------|-----------------|
| ICO `purchase` | User input → `adminWallet` |
| Engine `participate` | User input → Pancake swap |
| Lending security/repay | User input → `RaceOperationsTreasury` (configured) |
| Virtual income | **Not on-chain USDT** — USD-notional ledger |
| Withdrawal | Admin/process pays user off-platform USDT (operational) |
| Swap | Explicit RACE↔USDT on Pancake (user-initiated) |

**Rule check:** Platform rewards default to **USDT-notional virtual** / **RACE on engine** — consistent. **Conflict:** Docs/marketing may say “all income RACE” while Laravel pays USDT-notional virtual income.

---

## 10. Staking audit

**Active engine (testnet):** `raceCommunityEngine` = `0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef` (manifest).  
**Legacy:** `RaceStaking.sol`, `RaceParticipation.sol` — parallel contracts; Laravel may index participation separately.

| Plan | dailyRateBps (approx) | Notes |
|------|----------------------|-------|
| Flexible (0) | 50 bps | After ICO complete |
| 180d / 365d / 730d / 1095d | 50/70/90/100 bps | Fixed unlock |

**Maturity:** 10% RACE fee to `maturityTreasury`; 90% EMI escrow (30/30/rest). **Separate** from Laravel withdrawal admin fee.

---

## 11. ICO audit

| Phase | Price | RACE cap | USDT cap (code) |
|-------|-------|----------|-----------------|
| 1 | $0.25 | 200k | $50k |
| 2 | $0.35 | 200k | $70k |
| 3 | $0.45 | 200k | $90k |
| **Total** | — | **600k** | — |

`icoCompleted()` gates: Engine flexible participate, `RaceLendingBorrowing.isLendingEnabled()`.

---

## 12. Claim audit

- `claimEnabled` (owner)
- ICO complete for flexible paths
- `CLAIM_COOLDOWN` 24h (`lastSuccessfulClaimAt`)
- `MAX_REWARD_DAYS` caps accrual window
- Mint via vault on successful claim

---

## 13. Compound audit

Laravel: `VirtualIncomeCompoundController` — reserve → on-chain tx verify → `IncomeWalletTransaction` TYPE_COMPOUND; reconciliation commands exist (`IncomeReconcilePendingCompoundsCommand`). **HYBRID.**

---

## 14. Withdrawal audit (verified in code)

`RewardPlan::calculateWalletWithdrawalFee`:
- **Team reward:** 10% of gross
- **Admin fee:** $1 flat if gross < $100; else **1%** of gross (`percent_from_usd` = 100)
- **Min gross:** $1

**CONFIRMED** in `WithdrawalTeamRewardTest` / `RewardPlan.php` — matches stated business rules.

---

## 15. Fixed maturity (Engine)

`matureStake`: 10% `WITHDRAWAL_FEE_BPS` (1000 bps) to `maturityTreasury` — **RACE**, not USDT admin fee. EMI schedule 30/30/90 days.

---

## 16. Flexible withdrawal (Engine)

`withdrawStake`: 10% fee RACE; `_payTeamRewards` weights **[25,15,12,10,9,8,6,5,5,5]** — **CONFIRMED** in constructor initialization `RaceCommunityEngine.sol`.

---

## 17. Lending audit (`RaceLendingBorrowing.sol`)

| Rule (code) | Status |
|-------------|--------|
| ICO gate | `raceIco.icoCompleted()` |
| Smart $100–499, 20% security, 7d, 80% disburse/repay | Implemented USDT-only |
| Smart Pro $500/$1000, 30%, 70% disburse | Implemented |
| 30d / 90d / 180d charges | 50 USDT schedule (90d = 3×50) |
| 91–180 income | **BLOCKED** (`Lending__BusinessRuleBlocked91To180`) |
| RACE 100% auto-stake | **CONTRADICTION** — **NOT in contract** (notional only) |
| Deployed | **NO** (not in `deployment.json`) |

---

## 18. Lending user block (Laravel)

- `lending_user_status` ACTIVE/BLOCKED
- `LendingAccessGuard` → HTTP 403 `LENDING_ID_BLOCKED` on POST lending routes
- Does **not** block on-chain `openSmartLending` if user uses wallet directly
- Audit log: `lending_admin_actions` (immutable created_at only)

---

## 19. Virtual income wallet state

| Flag | State |
|------|-------|
| Default production | **ACTIVE**, DB authoritative |
| `INCOME_VAULT_AUTHORITATIVE=true` | Hybrid read from indexer; writes guarded |
| `blockchain_only` | Virtual mutations blocked |

---

## 20. On-chain income vault state (from config + manifest)

```
INCOME_VAULT_DEPLOYED=NO (manifest)
INCOME_VAULT_AUTHORITATIVE=NO (default env)
MAINNET_DEPLOYED=NO
```

Code complete; settlement signer + liquidity required for production.

---

## 21. TREASURY_WITHDRAWAL_AUTHORITY_MATRIX

| Treasury | Token | Withdraw caller |
|----------|-------|-----------------|
| RaceTreasury | RACE | `multisig` only |
| RaceDevelopment/Marketing/Operations | RACE+USDT | `multisig` only |
| RaceICO | USDT/RACE | **Owner** sweeps (`withdrawExcessUSDT`, etc.) |
| Income vault pool | USDT | User withdraw + signed credits (not treasury withdraw) |

---

## 22. MultiSig

**Code:** 5 signers, 3 confirmations (`RaceMultiSig.sol`). **Manifest:** matches `multisigThreshold: "3"`, 5 addresses listed.

---

## 23. RACE_MINT_AUTHORITY_MATRIX

| Role | Can mint? |
|------|-----------|
| Whitelisted minter (`setMinter`) | Yes ≤ MAX_SUPPLY |
| ICO | If minter |
| RewardVault | If minter, `onlyEngine` |
| governanceMint | Owner/governance, monthly cap |
| Random user | No |

**Gap vs locked tokenomics:** `INITIAL_MINT` 1M + `governanceMint` not in locked bucket table; **30M expense cap NOT enforced on-chain**.

---

## 24–26. Reward vault, Oracle, Governance

- **Vault:** `pay` onlyEngine; mints RACE.
- **Oracle:** Owner/updater `updatePrice`; staleness/deviation bounds; drives claim RACE amount.
- **RaceGovernance:** 10–12 members, timelock proposals on whitelisted targets.
- **RaceGovernor:** Stake-weighted votes, arbitrary call execution after delay — **parallel** to multisig; know which is live for ops.

---

## 27–28. ADMIN_POWER_MATRIX (summary)

| Role | Income/balance | Block user | Withdraw approve | Mint | Treasury |
|------|----------------|------------|------------------|------|----------|
| Orchid `platform.data` | **Ledger CRUD**, investments, income jobs | Team screen withdrawals_disabled | Withdrawal edit | No | Treasury address config |
| Orchid lending perms | No direct balance | Lending ID block/unblock | No | No | No |
| Contract owner (→ MultiSig on testnet) | Engine pause, claim toggle, oracle | No | No | Via governanceMint/minter setup | Via MultiSig |
| MultiSig | Generic calls | No | No | If proposal | Yes |
| Settlement signer | Vault credits only | No | No | No | No |

**High risk:** `LedgerEntryEditScreen` create/edit/delete with warning only — **financial mutation**.

---

## 29. Security findings (selected)

| ID | Sev | Finding |
|----|-----|---------|
| SEC-01 | CRITICAL | Admin manual ledger entry edit/create (`platform.data`) can alter balances without on-chain counterpart |
| SEC-02 | CRITICAL | Default mode: Laravel DB is authoritative for user withdrawable income |
| SEC-03 | CRITICAL | Lending block is app-layer only — on-chain lending bypass if contract deployed |
| SEC-04 | CRITICAL | `INCOME_VAULT_SETTLEMENT_PRIVATE_KEY` in env — key compromise = forged credits if vault live |
| SEC-05 | HIGH | Oracle price updatable — affects all RACE reward sizing |
| SEC-06 | HIGH | `governanceMint` + `INITIAL_MINT` vs locked allocation documentation |
| SEC-07 | HIGH | No 30M expense cap in `RaceMultisigFund` |
| SEC-08 | MEDIUM | Income vault security tests flaky (`ExpiredDeadline` wall clock) |
| SEC-09 | MEDIUM | Engine bytecode on testnet may differ from repo (UNVERIFIED without live diff) |
| SEC-10 | LOW | `.env.example` incomplete vs `income_vault` / `race_lending` keys |

---

## 30. Decentralization classification

| Operation | Class |
|-----------|-------|
| Engine stake/claim | ON-CHAIN |
| ICO purchase | ON-CHAIN |
| Laravel ROI/leadership/withdraw | OFF-CHAIN |
| Virtual wallet balance | OFF-CHAIN (default) |
| Income vault | ON-CHAIN (optional layer) |
| Admin deposit/withdraw approval | OFF-CHAIN ops |

If Laravel offline: users can still interact with **deployed contracts**; **virtual income accrual/withdraw stops**.

---

## 31. DATABASE vs BLOCKCHAIN authority

| Value | Default authority |
|-------|-------------------|
| `income_wallet_transactions` sum | **DATABASE** |
| `investments.accrued_reward_usd` | **DATABASE** |
| Engine stakes | **BLOCKCHAIN** |
| `on_chain_income_*` | **READ MODEL** (indexer) |
| ICO sold | **BLOCKCHAIN** |

Reconciliation: `income:reconcile-onchain`, `income:reconcile-wallets`, `decentralization:check`.

---

## 32. End-to-end examples (formula-based)

**A–D:** See sections 6–16; use `$1,000` principal, 0.5% daily → $5 accrual; claim → virtual wallet; withdraw $100 gross → team $10, admin $1, net $89.

**E – Lending $400 (code, not business doc):** Security $80 USDT to treasury; disburse $320 USDT; **no RACE mint**; repay $320 within 7 days.

**F – Lending $800 Pro:** Security $240; disburse $560; 30/90/180 paths per option; charges $50 schedules — **UNRESOLVED** 91–180 income.

**G – Lending block:** POST `/lending/smart` → 403 `LENDING_ID_BLOCKED`; GET `/lending` still shows history.

**H – Governance:** `propose` → vote → queue → timelock → `execute` on governed target (`RaceGovernance.sol` pattern).

---

## 33. Failure scenarios (summary)

| Failure | Money state |
|---------|-------------|
| Withdraw pending | Gross debited from virtual wallet; approval returns USDT off-chain |
| Reject withdraw | Refund via virtual `adjustment` |
| Compound tx fails | Reconcile/refund paths in commands |
| Indexer down | Stale read model; authoritative vault mode shows old balance |
| Contract paused | Revert on-chain; Laravel may still accrue (desync risk) |

---

## 34. SMART CONTRACT SECURITY MATRIX (summary)

See subagent audit: ReentrancyGuard on vault/lending/engine user entrypoints; **RaceCoin not pausable**; owners on testnet transferred to MultiSig per manifest postDeployTxs.

---

## 35. DEPLOYMENT AUDIT

| Item | Testnet | Mainnet |
|------|---------|---------|
| Manifest | `deployment.json` chain 97 | NOT_FOUND |
| Income vault address | Absent | Absent |
| Lending address | Absent | Absent |
| Laravel env | Must match manifest for reads | UNVERIFIED |

---

## 36. TEST COVERAGE

| Suite | Result (2026-09-21 run) |
|-------|-------------------------|
| PHPUnit | **136 passed**, 16 skipped |
| Hardhat full | **Partial FAIL** — `RaceIncomeVaultSecurity` deadline tests (`IncomeVault__ExpiredDeadline`) intermittent |
| Lending tests | PASS (31) |
| Lending block tests | PASS (10) |

**Missing critical tests:** Mainnet config E2E; live engine bytecode parity; on-chain lending block enforcement (not applicable until deploy).

---

## 37. Financial reconciliation

Virtual withdrawal: **gross = team + admin + net** (`RewardPlan` — verified).  
Engine flexible withdraw: **fee + net = principal** RACE.  
Unallocated team share on Laravel withdraw → company `withdrawal_admin_fee` meta.

**Orphan risk:** Manual ledger edits without wallet mirror sync.

---

## 38. BUSINESS LOGIC CONTRADICTIONS

| ID | Doc / expectation | Code reality |
|----|-------------------|--------------|
| C-01 | Lending: 100% loan value in RACE auto-staked | `RaceLendingBorrowing` stores notional only; no Engine call |
| C-02 | Locked 30M expense bucket | No on-chain 30M cap on multisig funds |
| C-03 | Locked “remaining 119.4M” explicit | Only `MAX_SUPPLY - totalSupply()` enforcement |
| C-04 | All user income as RACE | Laravel virtual wallet USDT-notional for most platform income |
| C-05 | Income vault “production ready” docs vs manifest | Vault not deployed testnet |

---

## 39. FINAL MASTER FLOW (ASCII)

```
USER → Register/Login (wallet signature)
     → Deposit (on-chain verify and/or ledger wallet_deposit)
     → ICO purchase (USDT→admin, RACE mint→Engine stake) OR Engine participate
     → STAKE (Engine storage)
     → REWARD (claim/compound ON-CHAIN RACE | Laravel roi_accrual OFF-CHAIN)
     → REFERRAL/LEVEL/LEADERSHIP/TEAM (DB and/or Engine)
     → VIRTUAL WALLET / (future INCOME VAULT)
     → WITHDRAWAL (fees 10% + $1/1% OFF-CHAIN)
     → TREASURY / TEAM / ADMIN (ledger + ops payout)
     → MULTISIG (treasury outflows)
     → GOVERNANCE (parameter proposals)
```

---

## 40. TOP 20 — verify before mainnet

1. MultiSig owns token, engine, oracle, treasury  
2. Minters list minimal (ICO + vault only)  
3. `lockMaturityTreasury` executed  
4. ICO `icoCompleted` procedure tested  
5. Engine bytecode matches audited repo tag  
6. Oracle updater keys secured / multisig-controlled  
7. Laravel `REWARDS_ENGINE` intentional for prod  
8. Income vault deploy + signer HSM  
9. Liquidity pool funded for vault withdrawals  
10. Indexer HA + reorg procedure tested  
11. Withdrawal ops KYC/payout process  
12. Admin ledger edit policy disabled or gated  
13. Lending RACE stake requirement resolved (product vs code)  
14. 30M expense tracking off-chain vs multisig  
15. governanceMint policy documented  
16. Frontend contract addresses = manifest  
17. No private keys in repo  
18. PHPUnit + Hardhat CI green  
19. UAT `uat-e2e-results.json` reviewed  
20. Mainnet deploy explicitly blocked until sign-off  

## 41. TOP 20 — admin must NEVER do (design intent)

1. Mint RACE arbitrarily (must not have minter key)  
2. Withdraw treasury without MultiSig  
3. Edit ledger to steal balances (must be impossible or heavily gated)  
4. Approve forged withdrawals  
5. Change user wallet to steal account  
6. Bypass withdrawal fees  
7. Double-credit income  
8. Delete audit logs  
9. Set `INCOME_VAULT_AUTHORITATIVE` without vault deploy  
10. Publish settlement private key  
11. Unblock stolen lending ID without review  
12. Modify on-chain ownership from Laravel  
13. Run ROI cron on wrong day twice without idempotency check  
14. Override referral tree for payout  
15. Set oracle price maliciously (admin shouldn't have sole key)  
16. Pause engine without MultiSig policy  
17. Deploy unaudited contracts from admin panel  
18. Grant self `platform.data` without oversight  
19. Process withdrawal without balance check  
20. Reset user password to impersonate (wallet auth reduces but Orchid users exist)  

## 42. TOP 20 — governance must NEVER do (without explicit design)

1. Mint unlimited RACE via malicious proposal  
2. Point vault signer to attacker  
3. Disable `claimEnabled` permanently without recovery plan  
4. Redirect ICO adminWallet to EOA  
5. Drain multisig treasuries in one tx  
6. Change MAX_SUPPLY (not upgradeable — must not add proxy)  
7. Whitelist malicious governed target  
8. Reduce timelock to zero  
9. Replace all signers unilaterally (impossible in MultiSig — good)  
10. Set fee recipients to attacker (RaceCoin `setFeeRecipients`)  
11. Override vesting schedules  
12. Execute proposals without quorum  
13. Vote with flash-loaned stake (Governor — check stake snapshot)  
14. Bridge user funds (NOT_FOUND — don't add unchecked)  
15. Cancel user stakes  
16. Modify lending contract treasury to EOA  
17. Disable oracle staleness checks  
18. Grant minter to arbitrary address  
19. Run governance parallel to MultiSig without clarity  
20. Execute on Laravel DB (governance can't — keep separation)  

---

**End of report.** No code, config, schema, or contracts were modified during this audit.
