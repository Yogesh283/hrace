# Engine Redeployment — Security Report (Read-Only Audit)

**Generated:** 2026-09-16 (audit task; no deploy performed)  
**Security posture (ecosystem):** `SECURITY_STATUS = AMBER` — CRITICAL_OPEN = 0, HIGH_OPEN = 2 (trust surfaces), MEDIUM/LOW remain.

---

## Executive summary

Repository source contains **ENG-HIGH-01** (`require(msg.sender == user, "engine: not user")` in `distributeReward`). The **live** BSC Testnet active CommunityEngine bytecode **does not match** a current local compile of `RaceCommunityEngine`. Treat the deployed instance as **fix not confirmed on-chain** until a new deploy is verified or auth is proven under `claimEnabled=true`.

---

## Required output fields

```
OLD_ENGINE = 0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef
NEW_ENGINE = NOT DEPLOYED
LIVE_ENGINE_FIX_STATUS = NOT_CONFIRMED
STATE_MIGRATION_REQUIRED = NO
RELINK_REQUIRED = YES
CLAIM_ENABLED = FALSE
MAINNET_DEPLOYMENT = NOT ALLOWED
```

---

## Phase 1 — Readiness audit (summary)

| Topic | Finding |
|-------|---------|
| Redeploy script | `contracts/scripts/redeploy-engine-c1-testnet.js` |
| Constructor | `(deployer, usdt, raceCoin, pancakeRouter, rewardVault)` |
| Owner (live) | MultiSig `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| RaceCoin | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| RaceRewardVault | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| RaceICO | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| RaceTreasury | `0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A` |
| Oracle | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| MultiSig | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` (3-of-5) |
| Deprecated engine | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |

Detail: `docs/ENGINE_REDEPLOYMENT_PLAN.md`.

---

## Phase 3 — State / migration

Searched `RaceCommunityEngine.sol` for migration / import / state-transfer mechanisms: **none**.

**Statement:** *Existing stakes remain on old Engine and must not be silently abandoned.*

- Stakes on `0xc0D9…` and any on `0xbdDe…` stay on those contracts.
- Redeploy creates a **new empty** engine; relinking vault/ICO does **not** copy mappings.
- `STATE_MIGRATION_REQUIRED = NO` means there is **no protocol migration path** — not that user stakes can be ignored.

---

## Phase 4 — Live bytecode verification

**Script:** `contracts/scripts/verify-engine-bytecode-testnet.js`  
**Command:** `cd contracts && npm run verify:engine-testnet`

**Last run:** `verifiedAt` ≈ 2026-09-16T01:11:34Z (chainId 97)

| Signal | Result |
|--------|--------|
| Bytecode present | Yes |
| `matchesCurrentRepoCompile` | **false** |
| Local deployedBytecode hash | `0x32cea51dd3148c3183ee453dcd25f4bea94ce5c191b22962d25fdae41be36e77` |
| On-chain runtime hash | `0xc1653823b330c5a6114a1da943dcf05ef212ffa0e5461ea9117534ac103134db` |
| Length mismatch | local 41806 vs on-chain 41656 hex chars |
| Config alignment | All manifest checks **true** (owner, vault/ICO links, coin, vault, oracle, ICO, treasury) |
| `claimEnabled` | **false** |
| `totalStakesCreated` | 0 |
| Auth probe `distributeReward` | **INCONCLUSIVE** — reverts on claim/ICO gate before auth can be distinguished |

**Interpretation:**

- Bytecode mismatch ⇒ live code is **not** the current repo build ⇒ **NOT_CONFIRMED** for ENG-HIGH-01 on-chain.
- With `claimEnabled=false`, `eth_call` from a third party may revert for reasons other than `engine: not user`; do **not** treat INCONCLUSIVE as proof of safety.
- After redeploy: re-run verify; optionally enable claim on a **fork** or controlled environment to assert `HARDENED` probe.

---

## Phase 6 — Repository security test

**File:** `contracts/test/security/RaceEngineDistributeRewardFix.test.js`

| Case | Expected | Status |
|------|----------|--------|
| Attacker calls `distributeReward(victim, 0)` | Revert `engine: not user` | Pass |
| User calls `distributeReward(self, 0)` | Success, RACE balance increases | Pass |
| User `claimReward(0)` | Success, legitimate flow | Pass |

No reward economics changed — authorization only.

**Broader suite (user-reported):** Hardhat 141 passed; PHPUnit 118 passed, 16 skipped.

---

## Phase 2 / 5 — Plans and checklist

- Procedure: `docs/ENGINE_REDEPLOYMENT_PLAN.md`
- Operator checklist: `docs/ENGINE_REDEPLOYMENT_CHECKLIST.md`

---

## Relink scope when NEW_ENGINE is deployed

| Contract | Function | Required |
|----------|----------|----------|
| RaceRewardVault | `setEngine(new)` | YES (MultiSig) |
| RaceICO | `setStakingEngine(new)` | YES (MultiSig) |
| RaceCoin minters | — | NO change in C-1 script |
| Oracle / Treasury / ICO sale | — | NO redeploy; engine setters re-applied on new instance only |

---

## Mainnet

**MAINNET_DEPLOYMENT = NOT ALLOWED** as part of this remediation track. `contracts/package.json` blocks `deploy:mainnet`. Engine redeploy plan is **testnet-only**.

---

## Recommended next steps (human / governance)

1. Approve testnet C-1 redeploy using checklist.
2. Execute `redeploy-engine-c1-testnet.js` with env confirmations.
3. Verify new address bytecode match + MultiSig ownership + relinks.
4. Update indexer/Laravel engine address if not loaded from manifest.
5. Communicate to any testnet users with stakes on **deprecated** engine addresses which contract to use.
6. Do **not** enable mainnet claim/engine until separate mainnet governance and audit gate.
