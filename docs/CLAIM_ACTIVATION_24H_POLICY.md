# Claim Activation + 24-Hour Cooldown Policy

**Project:** Rynexcapital  
**Network:** BSC Testnet first (chain **97**)  
**Contract:** `RaceCommunityEngine.sol`  
**Mainnet executed:** **NO**

---

## Architecture decision (claim scope)

| Aspect | Behavior |
|--------|----------|
| **Claim entrypoint** | `claimReward(uint256 stakeIndex)` — **per-position / per-stake** (existing architecture preserved) |
| **24h cooldown** | **Per-user global** — one successful wallet claim per 24 hours across all stakes |
| **Accrual formula** | Unchanged — `principalUsdt × dailyRateBps × daysOwed` via oracle; `MAX_REWARD_DAYS` cap unchanged |
| **Compound / withdraw / mature** | **Not** gated by `claimEnabled` or 24h cooldown (unchanged business paths) |

**Limitation documented:** User chooses **which stake** to claim, but may only complete **one successful claim tx per 24h** for their wallet.

---

## Phase flow

| Phase | ICO | `claimEnabled` | User claim |
|-------|-----|----------------|------------|
| 1 — ICO active | `RaceICO.icoCompleted() == false` | any | **Disabled** (`engine: ico active`) |
| 2 — ICO done, admin off | `true` | `false` | **Disabled** (`engine: claim disabled`) |
| 3 — Admin enables | `true` | `true` | Allowed if cooldown + reward |
| 4 — After claim | `true` | `true` | Blocked 24h (`engine: claim cooldown`) |

**ICO completion source of truth:** `RaceICO.icoCompleted()` only — no duplicate Laravel flag.

---

## On-chain gates (`_claimReward`)

```
claimReward(stakeIndex)
  → require RaceICO.icoCompleted()   (if icoContract wired)
  → require claimEnabled == true
  → require block.timestamp >= lastSuccessfulClaimAt[user] + 24h
  → _settleAccruedReward (existing formula)
  → if rewardRace > 0: lastSuccessfulClaimAt[user] = block.timestamp
```

- **Failed/reverted claim:** cooldown **not** updated  
- **Zero-reward claim (nothing owed):** cooldown **not** updated  
- **Successful mint:** cooldown updated atomically in same tx  

---

## State variables

| Variable | Type | Default | Notes |
|----------|------|---------|-------|
| `claimEnabled` | `bool` | `false` | Protocol admin via `setClaimEnabled` |
| `CLAIM_COOLDOWN` | `uint256` constant | `24 hours` | Immutable |
| `lastSuccessfulClaimAt` | `mapping(address => uint256)` | `0` | Unix timestamp |

---

## Admin authority

| Action | Function | Authority |
|--------|----------|-----------|
| Enable/disable claims | `setClaimEnabled(bool)` | `onlyOwner` (Testnet: MultiSig after hardening) |
| ICO completion | `RaceICO` phase completion | Existing ICO logic — **not** Laravel |

Laravel **does not** control funds or claim toggles. UI may read chain state only.

---

## Events

| Event | When |
|-------|------|
| `ClaimEnabledUpdated(bool enabled)` | Admin toggles claim |
| `ClaimCooldownRecorded(address user, uint256 nextAllowedClaimAt)` | Successful claim updates cooldown |
| `RewardPaid(...)` | Existing — unchanged reward accounting |

Indexer maps both new events in `blockchain_events` (read-only audit).

---

## Views

| Function | Purpose |
|----------|---------|
| `nextAllowedClaimAt(address user)` | UI countdown source |
| `canClaimRewards(address user)` | ICO + claimEnabled + cooldown (not reward balance) |

---

## Frontend (`/ico` — `Isu.jsx`)

| State | Message |
|-------|---------|
| ICO not complete | “Claiming is not active yet.” |
| ICO complete, claim disabled | “Claiming will start when enabled.” |
| Enabled, cooldown active | “Next claim available in: HH:MM:SS” |
| Enabled, cooldown clear | “Claim Now” |

- Reads via `readClaimEnabled`, `readCanClaimRewards`, `readNextAllowedClaimAt` (+ RPC fallback)  
- Button disable is UX only — **contract enforces** all rules  

**Admin toggle:** Engine owner wallet calls `setClaimEnabled` on-chain (e.g. MultiSig signer via MetaMask). No Laravel admin backdoor.

---

## Laravel / indexer

- **Not** source of truth for claim eligibility  
- `blockchain:index-events` indexes `ClaimEnabledUpdated`, `ClaimCooldownRecorded`, `RewardPaid`  
- Optional read-only RPC helpers in `CommunityEngineRpcReader` pattern  

---

## Testnet deployment note

**Existing deployed Engine (`0xc0D9…`) does NOT include this logic until upgraded/redeployed.**

After Testnet Engine deploy with updated bytecode:

```powershell
# Owner/multisig signer via cast/hardhat — example only
# engine.setClaimEnabled(true)  AFTER RaceICO.icoCompleted() == true
```

Do **not** enable claims before ICO completion.

---

## Solidity tests

File: `contracts/test/RaceCommunityEngineClaimPolicy.test.js`

| # | Test | Result |
|---|------|--------|
| 1 | ICO not complete → revert | PASS |
| 2 | ICO complete + claim disabled → revert | PASS |
| 3 | ICO complete + enabled → claim success | PASS |
| 4 | Second claim < 24h → revert | PASS |
| 5 | Claim after 24h → success | PASS |
| 6 | Failed/zero claim → cooldown unchanged | PASS |
| 7 | Multi-day wait accrual unchanged | PASS |
| 8 | Unauthorized `setClaimEnabled` → revert | PASS |

Full suite: **132 passing** (`npm test` in `contracts/`).

---

## Security considerations

- Cooldown is **on-chain** — frontend bypass insufficient  
- Per-user global cooldown prevents claim spam; user picks stake index  
- `distributeReward` uses same `_claimReward` gates  
- Reward oracle / team rewards / EMI / maturity paths untouched  
- Mainnet untouched until explicit governed rollout  

---

## Final status (code + tests)

| Check | Status |
|-------|--------|
| **ICO_COMPLETION_GATE** | **PASS** (Solidity tests) |
| **CLAIM_ENABLE_CONTROL** | **PASS** (owner-only `setClaimEnabled`) |
| **CLAIM_24H_COOLDOWN** | **PASS** (on-chain `lastSuccessfulClaimAt`) |
| **REWARD_FORMULA_UNCHANGED** | **PASS** (same `_settleAccruedReward` math) |
| **UNAUTHORIZED_ADMIN_BLOCKED** | **PASS** |
| **MAINNET_EXECUTED** | **NO** |
| **Live Testnet Engine upgraded** | **PENDING** (requires Engine redeploy — not auto-run) |

---

## Files changed

- `contracts/src/RaceCommunityEngine.sol`
- `contracts/src/mocks/MockIcoCompletion.sol`
- `contracts/test/RaceCommunityEngineClaimPolicy.test.js`
- `contracts/test/RaceCommunityEngine.test.js`
- `contracts/test/RaceFinancialSafety.test.js`
- `contracts/test/RaceICO.test.js`
- `resources/js/lib/web3Engine.js`
- `resources/js/Pages/Isu.jsx`
- `app/Console/Commands/IndexBlockchainEventsCommand.php`
