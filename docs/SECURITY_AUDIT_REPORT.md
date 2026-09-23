# RACE Ecosystem — Full Security / Hack-Resistance Audit Report

**Project:** Rynexcapital / Race Network  
**Path:** `C:\xampp\htdocs\Rynexcapital`  
**Audit date:** 2026-09-16  
**Auditor role:** Adversarial smart-contract + application security review  
**Constraints honored:** No business logic / tokenomics / reward % changes; no deploy; no mainnet interaction  

**Companion docs:** `docs/SECURITY_ATTACK_MATRIX.md`, `docs/SECURITY_INVARIANTS.md`  
**New tests:** `contracts/test/security/*.js`  

---

## 1. Executive Summary

The RACE stack is a **hybrid Web3 + Laravel** system: **RaceCoin**, **RaceICO**, **RaceCommunityEngine**, **RaceRewardVault**, and **RaceRewardPriceOracle** form the active reward/stake path; **RaceMultiSig (3-of-5)** owns critical contracts on BSC testnet per `contracts/deployments/bscTestnet/deployment.json`.

**Solidity (Hardhat):** Core access control on mint and vault pay is **correct for unprivileged attackers**. Maturity/EMI replay, ICO caps, and MultiSig threshold are **covered by existing + new security tests (8 new cases, all passing).**

**No upgradeable proxies** in `contracts/src/` — implementations are immutable once deployed.

**Residual risk is predominantly trusted-role and operational:** ICO USDT in `adminWallet`, oracle updater, 3-of-5 MultiSig, Laravel admin/hybrid ledger, legacy contracts still callable on-chain, and **permissionless `distributeReward`** on Engine/Participation.

**SECURITY_STATUS = AMBER** — no unprivileged direct mint/treasury drain proved, but **HIGH** issues remain (wallet binding without signature, privileged economic control, legacy exposure, mainnet config/compound verification gaps).

---

## 2. Contract Inventory

| Contract | File | Reachability | Notes |
|----------|------|--------------|-------|
| RaceCoin | `RaceCoin.sol` | All minters, transfers | MAX_SUPPLY 150M; 4% transfer fee |
| RaceICO | `RaceICO.sol` | Frontend `/ico`, indexer | USDT → `adminWallet` |
| RaceCommunityEngine | `RaceCommunityEngine.sol` | `web3Engine.js`, Laravel env | **Primary** stake/reward/maturity |
| RaceRewardVault | `RaceRewardVault.sol` | Engine only | Mints via `pay()` |
| RaceRewardPriceOracle | `RaceRewardPriceOracle.sol` | Engine rewards | Not Pancake for claims |
| RaceTreasury | `RaceTreasury.sol` | Maturity fee, MS withdraw | RACE only in contract |
| RaceMultiSig | `RaceMultiSig.sol` | Deploy scripts, ops | Fixed 5 signers, 3 confirmations |
| RaceGovernance | `RaceGovernance.sol` | Optional deploy | Whitelist targets; timelock |
| RaceGovernor | `RaceGovernor.sol` | **LEGACY** | Stake-weighted; testnet address in manifest |
| RaceStaking | `RaceStaking.sol` | **LEGACY** | Governor path |
| RaceRewardPool | `RaceRewardPool.sol` | **LEGACY** | Pre-funded pool transfers |
| RaceParticipation | `RaceParticipation.sol` | **LEGACY** testnet `0x9BF2…`; config optional | Pancake-priced rewards |
| RaceAutoLiquidity | `RaceAutoLiquidity.sol` | LP tooling | Fee recipient |
| RaceLiquidityLocker | `RaceLiquidityLocker.sol` | Unused testnet | null in manifest |
| RaceEcosystemVault / RaceVesting | various | Allocations | Not user reward path |
| RaceMultisigFund | `RaceMultisigFund.sol` | Tests / optional | MS helper |
| TestnetMockUSDT | `TestnetMockUSDT.sol` | Chain 97 only | Owner mint |
| Interfaces / libraries / mocks | `contracts/src/...` | Tests | MockERC20 mint is **public** (test only) |

**Deprecated engine (testnet):** `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` — legacy stakes; active engine `0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef` (C-1).

---

## 3. Trust Model

| Actor | Power |
|-------|--------|
| **RaceMultiSig (3/5)** | Owner of Engine, ICO, Vault, Oracle, RaceCoin, Treasuries — pause, `setClaimEnabled`, `setEngine`, `setMinter`, phases, oracle owner actions |
| **ICO `adminWallet`** | Receives **all** ICO USDT; full custody off-chain |
| **Oracle updater** | Moves `racePriceUsdt` within min/max and deviation bps → changes RACE minted per USDT ROI |
| **Governance members** | If deployed + target whitelisted: timelocked calls — **must not** include MultiSig as governed target (convention) |
| **Laravel admin** | Virtual income, withdrawal approve, Orchid user wallet edits |
| **User** | Own wallet keys; stake/claim/mature on Engine |

---

## 4. Privileged Roles (summary)

See §13 in findings. **No `delegatecall` / proxy** in project sources. **`tx.origin`** not used in project contracts.

---

## 5. Token Security (`RaceCoin.sol`)

### Mint paths (complete list)

| Path | Caller | Cap |
|------|--------|-----|
| Constructor | deployer | `INITIAL_MINT` = 1_000_000 RACE |
| `mint(to, amount)` | `isMinter[msg.sender]` | `totalSupply + amount <= MAX_SUPPLY` |
| `governanceMint(to, amount)` | `governance` **or** `owner()` | Same + 1% MAX_SUPPLY per 30-day month |

**Mathematical MAX_SUPPLY bound:** Every `_mint` goes through `mint()` or `governanceMint()` (or constructor once). Both enforce `require(totalSupply + amount <= MAX_SUPPLY)`. No other `_mint`. **Unauthorized EOA cannot mint.**

**Testnet minters (manifest):** RaceICO + RaceRewardVault only.

**Findings:**  
- **RACE-INFO-01:** 1M deploy mint to owner (documented; separate from 600k ICO bucket — marketing/ops alignment).  
- **RACE-MED-01:** Compromised `owner`/`governance` can `governanceMint` up to monthly cap until MAX_SUPPLY (trusted).  
- **RACE-LOW-01:** 4% fee on transfers; team reward distributions use `safeTransfer` — Engine is fee-exempt in deploy script.

---

## 6. ICO Security (`RaceICO.sol`)

- Purchase: phase active, caps, `totalSoldRace`, valid lock plan, nonReentrant.  
- **USDT → `adminWallet`**; **RACE mint → `stakingEngine`** then `openIcoStake(buyer, …)`.  
- **Separation preserved** in single tx (revert rolls back all).  
- Owner: `setAdminWallet`, `setStakingEngine`, phases, pause, sweep accidental tokens on ICO contract (not user stakes).

**Findings:**  
- **ICO-TRUST-01 (HIGH trusted):** `adminWallet` is often EOA on testnet — full USDT custody.  
- **ICO-MED-01:** Malicious **USDT** on wrong deployment could break assumptions — mitigated on testnet by `TestnetMockUSDT`; mainnet must pin `USDT_CONTRACT_BEP20`.  
- **ICO-LOW-01:** MEV/front-running on phase exhaustion — informational.

---

## 7. Engine Security (`RaceCommunityEngine.sol`) — priority

**Strengths:** `nonReentrant` on value flows; maturity CEI; EMI flags; `_requireClaimGates`; stake index scoped to `msg.sender` on user entrypoints; `onlyIco` on `openIcoStake`; MAX_REWARD_DAYS on claim/compound; uncapped settle on exit.

**Findings:**  
- **ENG-HIGH-01:** **`distributeReward(address user, uint256 stakeIndex)` is callable by anyone** — mints to `user`, sets **`lastSuccessfulClaimAt`** → **24h cooldown griefing** / forced claim timing. PoC: `test/security/RaceEngineGriefing.test.js`. Funds go to victim, not attacker — **griefing / policy**, not theft.  
- **ENG-MED-01:** **`distributeLeadershipForMember`** callable by anyone — mints to qualified `user` (keeper design); not theft.  
- **ENG-MED-02:** Owner can `setRewardPriceOracle` / `setIcoContract` / pause — **trusted MS**.  
- **ENG-MED-03:** Referral chain loops unbounded — deep tree **gas grief** on participate (low practical on BSC).  
- **ENG-LOW-01:** Compound does not trigger claim cooldown (intended).  
- **ENG-INFO-01:** Same pattern on **`RaceParticipation.distributeReward`**.

**Combination testing (claim/compound/withdraw/mature/EMI):** Covered by `RaceCommunityEngine.test.js`, `RaceMaturityEmi.test.js`, `RaceFinancialSafety.test.js`, `RaceMaturityReplay.test.js` — **no excess RACE** path found for unprivileged caller.

---

## 8. Reward Vault (`RaceRewardVault.sol`)

- `pay` → `onlyEngine` + `nonReentrant` → `RaceCoin.mint`.  
- **Attacker cannot call `pay` without controlling `engine` address** (owner sets via MS).

**Finding VAULT-LOW-01:** Malicious **`setEngine`** by compromised owner repoints mint authority — trusted MS risk.

---

## 9. Oracle (`RaceRewardPriceOracle.sol`)

- Updates: owner or `isUpdater`; bounds + deviation + staleness on read.  
- **Lowering price** increases RACE minted for fixed USDT reward (until MAX_SUPPLY).  
- **No single-block user sandwich** without updater collusion.

**Finding ORACLE-TRUST-01 (HIGH trusted):** Stolen updater key + low price within deviation → accelerated reward emission.

---

## 10. Treasury (`RaceTreasury.sol`)

- Only `multisig` may `withdraw` RACE.  
- **No USDT/BNB** withdraw in this contract.  
- **Unprivileged drain: NO.**

---

## 11. MultiSig (`RaceMultiSig.sol`)

- Fixed **5** signers, **3** confirmations; immutable signers.  
- **1–2 signers alone: cannot execute.**  
- **3 signers: full arbitrary `call`** to any target (including `setMinter`, `setEngine`, `transferOwnership`).

**Finding MS-INFO-01:** Failed execution reverts `executed` flag (state rollback) — safe.

Tests: `RaceMultiSigSecurity.test.js`.

---

## 12. Governance

- **RaceGovernance:** member vote + timelock + **governed target whitelist**. Cannot execute arbitrary address unless whitelisted. Self-config via `onlySelf`.  
- **RaceGovernor (legacy):** stake-weighted — flash-loan concern **if still used**.  
- **Community governance does not replace MultiSig** in code; risk is **ops mis-whitelisting** RaceCoin owner actions.

**Finding GOV-MED-01:** If `RaceCoin` whitelisted to governance, members could propose `setMinter` after timelock — **governance ≠ MultiSig**; document separation.

---

## 13. Access Control Table (selected)

| Function | Contract | Allowed | If compromised |
|----------|----------|---------|----------------|
| `mint` | RaceCoin | minters | Mint to MAX_SUPPLY |
| `governanceMint` | RaceCoin | governance, owner | Monthly cap mint |
| `pay` | Vault | engine | Unlimited user mint to cap |
| `purchase` | ICO | any user | N/A |
| `setAdminWallet` | ICO | owner (MS) | Redirect USDT |
| `setClaimEnabled` | Engine | owner (MS) | Disable/enable claims |
| `setEngine` | Vault | owner (MS) | Repoint mint |
| `updatePrice` | Oracle | updater, owner | Reward inflation/deflation |
| `withdraw` | Treasury | multisig contract | RACE out |
| `confirmTransaction` | MultiSig | signers | 3-of-5 execution |
| `distributeReward` | Engine | **anyone** | Griefing (see ENG-HIGH-01) |

---

## 14. Reentrancy Matrix (summary)

| Call site | Guard | CEI |
|-----------|-------|-----|
| ICO `purchase` | nonReentrant | USDT then mint then stake |
| Engine participate/claim/compound/withdraw/mature/EMI | nonReentrant | Maturity: effects before transfer |
| Vault `pay` | nonReentrant | mint after checks |
| MultiSig confirm | nonReentrant | executed before call; revert on fail |
| RaceCoin `_update` | none | fee splits (no external call) |

**ERC777-style hooks:** not used. **RaceCoin** standard ERC20.

---

## 15. Laravel ↔ Blockchain

| Control | Assessment |
|---------|------------|
| Wallet login/register | Signed nonce (`WalletAuthController`) — **good** |
| **`POST /wallet/connect`** | Sets `wallet_address` **without signature** — **LAR-HIGH-01** |
| Compound confirm | `CompoundTransactionVerifier` — receipt, chain, from, log — **good**; **`chainId !== 97` hard fail** — **LAR-MED-01** for mainnet |
| Default `BSC_CHAIN_ID` | **56** in `config/blockchain.php` if unset — **LAR-MED-02** misconfiguration |
| Virtual income | Admin + cron; hybrid duplicates possible without strict idempotency — **LAR-MED-03** ops |
| Indexer | Event names fixed (H-2); not auth boundary |

---

## 16. Legacy Contracts

| Contract | Still callable? | Mints RACE? | Affects active Engine? |
|----------|-----------------|-------------|-------------------------|
| RaceParticipation | **Yes** (testnet addr) | No — transfers from funded balance | No — parallel pool |
| Old Engine `0xc0D9…` | Yes for old stakes | Via vault only if it were still `engine` — **vault repointed** | Old stakes frozen to old logic |
| RaceRewardPool / Staking / Governor | Yes if funded | No mint | Separate legacy graph |

**Finding LEG-HIGH-01:** Users can still interact with **deprecated Participation** — dual economy + confusion.  
**Finding LEG-MED-01:** Deprecated engine bytecode drift (pre-C-1) — claims policy mismatch for legacy stakes.

---

## 17. Secrets Scan

| Item | Result |
|------|--------|
| Committed `.env` | **NOT FOUND** (gitignored) |
| Hardcoded 64-char private keys in repo | **NOT FOUND** |
| `DEPLOYER_PRIVATE_KEY` references | **FOUND** — placeholders in docs/scripts only (`contracts/hardhat.config.js`, `contracts/.env.example`) — **no live key printed** |

---

## 18. Denial of Service

| Vector | Result |
|--------|--------|
| Owner `pause()` Engine/ICO | **Trusted admin DoS** |
| Oracle stale | Claims/settle revert until heartbeat |
| Participation reward pool empty | Claims revert `insufficient reward vault` |
| MultiSig unbounded tx array | Gas growth for views — ops |

---

## 19. Precision / Integer

Solidity **0.8+** checked math. Reward: USDT-notional × bps / 10_000; RACE = rewardUsdt × 1e18 / price — **truncation favors protocol** (lower mint). EMI: 30/30/remainder — **sum equals emiPool** (asserted).

---

## 20. Security Test Results

| Suite | Result |
|-------|--------|
| `test/security/RaceMintSupply.test.js` | 3/3 pass |
| `test/security/RaceEngineGriefing.test.js` | 1/1 pass |
| `test/security/RaceMaturityReplay.test.js` | 3/3 pass |
| `test/security/RaceIcoCaps.test.js` | 1/1 pass |
| Existing `RaceMultiSigSecurity.test.js` | pass (run full CI for count) |

**Recommended:** run `npx hardhat test` before release.

---

## 21. Findings Register

| ID | Sev | Title |
|----|-----|-------|
| ENG-HIGH-01 | HIGH | Permissionless `distributeReward` → forced claim + cooldown |
| LAR-HIGH-01 | HIGH | Wallet connect without cryptographic proof |
| ICO-TRUST-01 | HIGH (trusted) | ICO USDT custody on `adminWallet` |
| ORACLE-TRUST-01 | HIGH (trusted) | Updater/owner price control → emission rate |
| LEG-HIGH-01 | HIGH | Legacy Participation still live on testnet |
| LAR-MED-01 | MEDIUM | Compound verifier testnet-only chain check |
| LAR-MED-02 | MEDIUM | Default mainnet chain_id / router / USDT fallbacks |
| LAR-MED-03 | MEDIUM | Hybrid virtual ledger insider risk |
| GOV-MED-01 | MEDIUM | Governance whitelist misconfiguration |
| LEG-MED-01 | MEDIUM | Legacy engine bytecode / stake isolation |
| ENG-MED-01 | MEDIUM | Permissionless leadership distribution (design) |
| VAULT-LOW-01 | LOW | Owner can repoint engine |
| ICO-LOW-01 | LOW | ICO MEV |
| RACE-INFO-01 | INFO | 1M initial mint |

*(Each finding: attack preconditions in §5–16 above; fixes in §27.)*

---

## 22. Mainnet Readiness

**NO-GO** until: ICO adminWallet = multisig or documented custody; oracle ops + multisig runbook; `CompoundTransactionVerifier` chain-aware; wallet connect requires signature; legacy contracts disabled or UI-warned; claim policy on **single** engine deployment; virtual ledger reconciliation.

---

## 23. Attack Tree

See `docs/SECURITY_ATTACK_MATRIX.md`.

---

## 24. Invariants

See `docs/SECURITY_INVARIANTS.md`.

---

## 25. Remediation Plan (patches — NOT applied)

### ENG-HIGH-01 — Restrict `distributeReward`

**Option A (minimal):** Remove public `distributeReward` or restrict to `msg.sender == user`.

```solidity
function distributeReward(address user, uint256 stakeIndex) external nonReentrant whenNotPaused {
    require(msg.sender == user, "engine: not user");
    _claimReward(user, stakeIndex);
}
```

Apply same to `RaceParticipation.sol` if kept.

### LAR-HIGH-01 — Wallet connect

Require SIWE-style signature in `WalletController::store` (reuse `WalletAuthService`) or only allow wallet binding via `WalletAuthController` register/login.

### LAR-MED-01 — Compound verifier

Replace `chainId !== 97` with allowlist from `config('blockchain.chain_id')` and validate receipt `chainId` from RPC.

### LAR-MED-02 — Config

Fail boot on production if `BSC_CHAIN_ID=97` with mainnet USDT/router addresses (`BlockchainConfigValidator` extend).

### LEG-HIGH-01 — Legacy

On-chain: pause legacy Participation via MS; off-chain: remove env addresses + UI routes; banner for old engine.

### ICO-TRUST-01 — Ops

Set `ICO_ADMIN_WALLET` to Gnosis Safe / RaceMultiSig fund holder; document custody.

### ORACLE-TRUST-01 — Ops

Multi-sig controlled updater; monitor deviation; secondary oracle read in UI.

---

## 26. Final Scorecard

| Metric | Count |
|--------|-------|
| CRITICAL_OPEN | **0** (unprivileged fund theft/mint not demonstrated) |
| HIGH_OPEN | **4** (ENG-HIGH-01, LAR-HIGH-01, LEG-HIGH-01, plus 2 trusted custody HIGH if counting ops) |
| MEDIUM_OPEN | **6+** |
| LOW_OPEN | **3+** |

| Question | Answer |
|----------|--------|
| CAN_ATTACKER_MINT_RACE | **NO** (without minter/engine/oracle/MS compromise) |
| CAN_ATTACKER_STEAL_USDT | **NO** on-chain (needs `adminWallet` or user approve phishing) |
| CAN_ATTACKER_DRAIN_TREASURY | **NO** (needs 3 MS signers) |
| CAN_ATTACKER_STEAL_USER_FUNDS | **NO** principal; **grief** on rewards/cooldown |
| CAN_BYPASS_CLAIM_COOLDOWN | **NO** |
| CAN_BYPASS_MATURITY | **NO** |
| CAN_BYPASS_ICO_CAP | **NO** |
| CAN_MANIPULATE_ORACLE | **NO** unprivileged; **YES** with updater key |
| CAN_BYPASS_MULTISIG | **NO** |
| CAN_BYPASS_GOVERNANCE_TIMELOCK | **NO** if governance deployed correctly |
| CAN_LEGACY_CONTRACTS_HARM_ACTIVE_SYSTEM | **YES** (parallel UX/economy; not vault mint bypass) |

**SECURITY_STATUS = AMBER**

---

*End of report. No production contracts, tokenomics, or business rules were modified during this audit.*
