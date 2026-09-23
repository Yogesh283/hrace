# TESTNET CONTRACT AUDIT

**Date:** 2026-09-13  
**Source of truth:** current `contracts/src/*.sol`  
**Compiler:** Solidity `0.8.20` (Hardhat)  
**Live BSC Testnet deploy this session:** **NOT EXECUTED** — `contracts/.env` absent  

**MULTISIG STATUS = UNCHANGED** (`RaceMultiSig.sol` not modified)

---

## 1. Inventory summary

| Contract | File | Owner model | Financial power | Gov / MS |
|----------|------|-------------|-----------------|----------|
| RaceMultiSig | RaceMultiSig.sol | 5 immutable signers | Executes arbitrary calls if signed 3/5 | MS itself |
| RaceCoin | RaceCoin.sol | Ownable | Mint (minters), fee on transfer, governanceMint (owner\|\|gov) | Owner=MS after harden; gov addr separate |
| RaceTreasury | RaceTreasury.sol | Ownable + multisig | RACE withdraw only via MS | MS withdraw |
| RaceDevelopment/Marketing/OperationsTreasury | RaceMultisigFund.sol | immutable MS | RACE+USDT withdraw via MS | MS only |
| RaceRewardVault | RaceRewardVault.sol | Ownable | mint via pay→RaceCoin | Engine-only pay |
| RaceCommunityEngine | RaceCommunityEngine.sol | Ownable | User stakes, rewards, EMI, team RACE | Config owner |
| RaceRewardPriceOracle | RaceRewardPriceOracle.sol | Ownable + updater | Price for reward sizing | Owner/updater |
| RaceICO | RaceICO.sol | Ownable + adminWallet | USDT in, mint RACE to Engine stake | Owner phases |
| RaceGovernance | RaceGovernance.sol | 10–12 members | Config via proposal+timelock | Community |
| RaceGovernor | RaceGovernor.sol | stake-weighted DAO | Legacy stake votes | Legacy |
| RaceParticipation | RaceParticipation.sol | Ownable | Legacy parallel staking path | **LEGACY / parallel risk** |
| RaceStaking / RaceRewardPool | … | Ownable + gov | Legacy | **LEGACY** |
| RaceAutoLiquidity | … | Ownable | Swap fee LP assist | Owner rescue |
| RaceLiquidityLocker | … | Ownable | Time-locked LP | Beneficiary unlock |
| RaceVesting / EcosystemVault | … | Ownable | Allocation vest / vault | Legacy wiring |

No `selfdestruct`, no UUPS/proxy upgradeability in production contracts.  
Arbitrary call: **RaceMultiSig**, **RaceGovernance.execute**, **RaceGovernor.execute**.

---

## 2. Risk table (evidence-based)

| Contract | Owner | Roles | Financial Power | Governance Power | MultiSig Power | Risk |
|----------|-------|-------|-----------------|------------------|----------------|------|
| RaceMultiSig | n/a | 5 signers | Call any target after 3/5 | None over MS | Full | HIGH if keys clustered |
| RaceCoin | Ownable | minter, governance | Mint ≤MAX; 4% fee | setFee*/govMint if gov set | setMinter if owner=MS | HIGH if owner EOA |
| RaceTreasury | Ownable | multisig | RACE out | Should not own | withdraw | MED if owner≠MS |
| Expense funds | none | MS immutable | RACE/USDT out | None | withdraw | LOW |
| Engine | Ownable | — | User funds custody | Config if owner | Config if owner | HIGH if bad owner |
| Vault | Ownable | engine | Mint income | setEngine if owner | Prefer MS owner | HIGH if setEngine abused |
| Oracle | Ownable | updater | Price | Owner setters | Owner if MS | MED (updater EOA) |
| ICO | Ownable | adminWallet | USDT proceeds; mint | Phases if owner | Prefer MS/Gov | MED |
| RaceGovernance | members | voters | Config calls | Full self+targets | Must not control MS | MED |
| RaceParticipation | Ownable | — | Parallel stake | — | — | MED duplicate path |

---

## 3. Critical security findings

### CRITICAL
*(None proven as active exploit in Hardhat suite against intended design.)*

**DEPLOY BLOCKER (ops):** No `contracts/.env` → cannot safely run live BSC Testnet deployment this session.

### HIGH
1. **RaceCoin owner power** — `setMinter` + `onlyGovernance` includes `owner`, so owner can `governanceMint` (1%/mo) and grant minters. After harden owner should be MultiSig only.  
2. **RaceICO owner withdrawals** — `withdrawUnsoldRACE` / `withdrawExcessUSDT` / `withdrawAccidentalRACE` are onlyOwner. Must not remain deployer EOA on public testnet after harden.  
3. **Dual staking surfaces** — `RaceCommunityEngine` (primary) + `RaceParticipation` (legacy) can both exist if both wired in frontend/Laravel → duplicate financial path risk.  
4. **RaceGovernance execute** — can call any **whitelisted** target; if RaceCoin ownership mistakenly transferred to Governance, mint path opens via owner. Audit already forbids this auto-transfer.

### MEDIUM
5. Deploy script defaults `USDT`/`PANCAKE_ROUTER` to **mainnet** addresses — testnet must override or STOP.  
6. `RaceGovernor` (stake DAO) still set as RaceCoin `governance` in full deploy — separate from Community Governance.  
7. Oracle updater EOA can move price within bounds/deviation — intentional ops risk.  
8. Multisig signers **immutable** — lost key = permanent limitation.  
9. Expense Multisig funds start empty; 30M expense split = business approval pending.

### LOW
10. `RaceLiquidityLocker` Ownable largely unused for unlock (public after time).  
11. Governance cancel only by proposer.  
12. Hardhat tests use time travel for EMI — not available on public testnet without waiting/warping.

### INFO
13. ICO prices/caps match expected (see Phase 7).  
14. MAX_SUPPLY = 150_000_000 ether.  
15. Multisig REQUIRED=3, SIGNER_COUNT=5.  
16. Hardhat: **118 passing** (local simulation, not live chain).

---

## 4. Token (RaceCoin) — proven from source

| Field | Value |
|-------|--------|
| name/symbol | Race Coin / RACE |
| decimals | 18 |
| MAX_SUPPLY | 150_000_000 ether |
| INITIAL_MINT | 1_000_000 ether to owner |
| FEE_BPS | 400 (4%) |
| mint | onlyMinter + ≤MAX_SUPPLY |
| governanceMint | owner\|\|governance + monthly 1% MAX + ≤MAX_SUPPLY |
| Deploy minters (script) | RaceICO, RaceRewardVault |

Unauthorized mint: non-minter reverts (covered in tests).

---

## 5. MultiSig — UNCHANGED

- 5 unique non-zero signers; threshold 3 immutable  
- Duplicate confirm blocked; non-signer blocked  
- `executed` flag; confirm/execute `nonReentrant`  
- No add/remove/replace/threshold change  
- **Do not use production mainnet signers for testnet**

---

## 6. Community Governance

- Members 10–12; 1 wallet = 1 vote  
- Threshold >50% (e.g. 7/12)  
- propose → vote → queue → timelock (≥1h) → execute  
- Target whitelist; self-config only via self-call  
- Must NOT auto-own RaceCoin / Multisig funds  

Expected testnet env (config, not hardcoding): 12 / 7 / 3d vote / 24h timelock.

---

## 7. ICO — verified against source

| Phase | Price | Allocation | USDT cap |
|-------|-------|------------|----------|
| 1 | $0.25 | 200_000 | $50_000 |
| 2 | $0.35 | 200_000 | $70_000 |
| 3 | $0.45 | 200_000 | $90_000 |
| Total | — | 600_000 | — |

Decimals: RACE must be 18; USDT decimals read from token (scale prices/caps).  
Flexible ICO stake rejected. Mint to Engine stake path.

---

## 8. Engine / Vault / Oracle / Treasuries

- Engine: flexible withdraw 10% team RACE; fixed mature 10% RaceTreasury + 90% EMI 30/30/rem; MAX_REWARD_DAYS=30 on claim path  
- Vault: `pay` onlyEngine → mint  
- Oracle: updater + bounds + staleness + deviation  
- Company Treasury: RACE, MS withdraw  
- Dev/Mkt/Ops: RACE+USDT, MS only, purpose required  

---

## 9. Legacy

| Contract | Status |
|----------|--------|
| RaceCommunityEngine | **ACTIVE** primary |
| RaceParticipation | **LEGACY / parallel** if still in UI |
| RaceStaking / RaceRewardPool / RaceGovernor | **LEGACY** stake DAO path |
| RacePlacement | **NOT FOUND** in src |

---

## 10. Live testnet status

| Check | Result |
|-------|--------|
| contracts/.env | **MISSING** |
| CONFIRM_TESTNET_DEPLOYMENT | N/A |
| Deployer key | N/A |
| Testnet USDT override | Not configured |
| Live deploy | **STOPPED** |

Hardhat suite is **not** a substitute for live chain UAT.
