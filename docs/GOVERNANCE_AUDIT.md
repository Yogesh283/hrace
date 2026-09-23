# GOVERNANCE AUDIT — RACE Network

**Date:** 2026-09-13  
**Scope:** Access control / who can change what.  
**Rule:** `RaceMultiSig.sol` is **NOT** modified. Community Governance is a **separate** layer.

## Existing RaceGovernor.sol

| Item | Finding |
|------|---------|
| Type | Stake-weighted DAO (`RaceStaking` weight) |
| Voting | 1 stake unit = 1 vote (NOT wallet-based) |
| Members | Any registered staker |
| Quorum | 5% of total active stake |
| Timelock | Fixed 1 day after vote end |
| Usable for 10–12 community wallets? | **No** — wrong model |

**Decision:** Keep `RaceGovernor.sol` as legacy stake DAO.  
**New contract:** `RaceGovernance.sol` — wallet/member Community Governance (10–12, 1 wallet = 1 vote).  
Do **not** blindly replace `RaceGovernor`; do **not** point RaceCoin `governance` at Community Governance without a separate mint-risk review (see RaceCoin).

---

## MultiSig vs Governance (boundary)

| Layer | Contract | Responsibility |
|-------|----------|----------------|
| **MultiSig** | `RaceMultiSig` (3-of-5) | Treasury withdraw, expense fund withdraw, security releases |
| **Community Governance** | `RaceGovernance` (10–12) | Protocol **configuration** via proposals + timelock |
| **Ops** | Oracle updater EOA | Price heartbeat only |
| **Immutable** | Caps, EMI math, MAX_SUPPLY, Multisig fund controller | Cannot be governed |

---

## Per-contract map

### RaceMultiSig
- **Owner/Admin:** N/A (5 immutable signers)
- **Roles:** signer
- **Mutable:** none (threshold/signers immutable)
- **Decision:** **C Immutable** / MultiSig-only. Governance must **never** control or replace it.
- **Govern?** No.

### RaceTreasury (Company)
- **Owner:** typically MultiSig after harden
- **Admin:** `multisig` address (immutable intent for withdraw)
- **Setters:** `setMultisig` (onlyOwner), `withdraw` (only multisig)
- **Decision:** Withdraw = **B MultiSig**. `setMultisig` = **B MultiSig** (keep owner = MultiSig).  
- **Govern?** No direct withdraw. Do not transfer ownership to Community Governance (could retarget multisig).

### RaceDevelopmentTreasury / Marketing / Operations (`RaceMultisigFund`)
- **Owner:** none (no Ownable)
- **Controller:** immutable `multisig`
- **Decision:** **B MultiSig** only. **C** controller immutable.
- **Govern?** No.

### RaceCoin
- **Owner:** onlyOwner → `setGovernance`, `setMinter`
- **governance addr:** `governanceMint`, `setFeeRecipients`, `setFeeExempt` (also owner via `onlyGovernance`)
- **Minters:** ICO + RewardVault
- **Immutable:** `MAX_SUPPLY`, fee BPS, monthly mint cap formula
- **Conflict:** If Community Governance becomes **owner**, it can call `governanceMint` (1%/mo cap) via owner path.
- **Decision:**  
  - Supply / mint authority = **B MultiSig** (owner) + **authorized minters** (unchanged).  
  - Fee recipients / fee exempt = **A Governance** *only if* `governance` points to Community Governance **and** owner remains MultiSig (so Governance cannot use owner mint path).  
  - **Do not** transfer RaceCoin ownership to Community Governance without further business approval.
- **Governed today (safe wiring):** register as target only after ownership model chosen; default testnet: **do not** auto-transfer RaceCoin to Community Governance.

### RaceICO
- **Owner:** startPhase, completePhase, setAdminWallet, setStakingEngine, pause, withdraws
- **Admin wallet:** USDT proceeds EOA (ops)
- **Immutable:** prices, 600k allocation, phase sizes
- **Decision:**  
  - Phase ops / pause / setStakingEngine / setAdminWallet = **A Governance** (config) *or* **B MultiSig** (current harden).  
  - Completed purchases / economics = **C Immutable**.  
  - Fund steal / mint bypass = **forbidden**.
- **Recommended:** Community Governance may own ICO for phase/pause; Multisig retains RaceCoin mint authority.

### RaceCommunityEngine
- **Owner:** pause, setIcoContract, setRewardPriceOracle, setMaturityTreasury, lockMaturityTreasury
- **Immutable after lock:** maturityTreasury destination
- **Forbidden for Governance:** confiscate stakes, erase rewards, alter user balances, bypass EMI/maturity
- **Decision:**  
  - pause / setIco / setOracle = **A Governance** (safe config).  
  - setMaturityTreasury after lock = **C** (reverts).  
  - User financial state = **C / protected by code**.
- **Govern?** Yes for pause/oracle/ico link only.

### RaceRewardPriceOracle
- **Owner:** setUpdater, setMaxStaleness, setBounds
- **Updater:** ops EOA `updatePrice`
- **Decision:** Owner params = **A Governance**. Updater = **D Operational wallet**.
- **Govern?** Yes (owner functions).

### RaceRewardVault
- **Owner:** `setEngine`
- **Engine:** `pay` (mint to users)
- **Decision:** `pay` = Engine only (**E**). `setEngine` = **B MultiSig** (high risk if Governance can retarget).
- **Govern?** No unrestricted pay. Prefer Multisig for `setEngine`.

### RaceLiquidityLocker
- **Owner:** Ownable (little power; unlock is public after time)
- **Immutable:** lp, beneficiary, unlockAt
- **Decision:** **C** time lock. Governance optional irrelevant.

### RaceParticipation / RaceAutoLiquidity / RaceStaking / RaceRewardPool / RaceEcosystemVault / RaceVesting
- Ownable / governance setters for legacy paths
- **Decision:** Config setters may be **A Governance** if ownership transferred; do not change ROI/business formulas in this task.
- RaceStaking/RewardPool already use `setGovernance(address)` pointing at **legacy RaceGovernor** — leave unless explicitly re-pointed.

### RaceGovernor (legacy)
- Keep deployed for stake DAO; separate from Community Governance.

---

## Functions that must NOT be community-governed

- Any `RaceMultiSig` internals  
- Treasury / MultisigFund `withdraw`  
- `RaceCoin.mint` / unlimited mint / MAX_SUPPLY changes  
- Engine user stake/reward mutation  
- Vault `pay` by non-engine  
- Changing completed ICO purchases / pricing constants  
- Unlocking locked maturityTreasury  

---

## Ownership recommendation (post-testnet wiring)

| Contract | Recommended owner/controller |
|----------|------------------------------|
| RaceMultiSig | Signers (immutable) |
| RaceTreasury + expense funds | MultiSig |
| RaceCoin | MultiSig (owner); optional `governance`→CommunityGovernance for fees only after review |
| RaceRewardVault | MultiSig |
| Engine, Oracle, ICO, Participation | Community Governance (config) **or** MultiSig until testnet verifies |
| Oracle updater | Ops EOA |

**Destructive ownership moves require Multisig (current owner) approval — not automatic in production deploy.**

---

## Conflicts reported (non-destructive)

1. **RaceGovernor vs RaceGovernance:** different models; both may coexist.  
2. **RaceCoin owner = Community Governance** would enable capped `governanceMint` — **STOP** auto-transfer.  
3. **Current `HARDEN_GOVERNANCE`** sends Engine/Oracle/ICO/Coin/Vault to **MultiSig**. Community Governance ownership transfer is a **separate** step after audit approval.
