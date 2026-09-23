# Security Remediation Report (HIGH fixes)

**Date:** 2026-09-16  
**Scope:** Confirmed HIGH items from `docs/SECURITY_AUDIT_REPORT.md` + compound chain-ID fix  
**Out of scope:** Tokenomics, reward %, ICO pricing, staking math, deploy, ownership, claim enable  

---

## Summary

| Fix | ID | Status |
|-----|-----|--------|
| Engine `distributeReward` caller restriction | ENG-HIGH-01 | **Source + tests** (on-chain redeploy required for live testnet) |
| Signed wallet link for `/wallet/connect` | LAR-HIGH-01 | **Implemented + tests** |
| Legacy `RaceParticipation` app path disabled | LEG-HIGH-01 | **Implemented + tests** |
| Compound verifier chain ID | (audit MEDIUM, requested) | **Implemented + tests** |

---

## 1. ENG-HIGH-01

**Finding:** Any address could call `RaceCommunityEngine.distributeReward(victim, …)` and trigger claim + 24h cooldown griefing.

**Root cause:** Public keeper-style API without caller binding to `user`.

**Caller trace:** No frontend/Laravel/cron caller uses `distributeReward` — only `claimReward` in `web3Engine.js`. Docs mentioned permissionless keeper; no contract internal caller.

**Fix:** `require(msg.sender == user, "engine: not user")` in `RaceCommunityEngine.sol`. Same guard on deprecated `RaceParticipation.sol` for parity (on-chain still callable if user interacts directly with legacy contract).

**Files:** `contracts/src/RaceCommunityEngine.sol`, `contracts/src/RaceParticipation.sol`, `contracts/test/security/RaceEngineGriefing.test.js`

**Business logic:** Unchanged — `_claimReward` path, amounts, cooldown, gates identical.

**Tests:** Attacker reverts; self-call passes. Hardhat **141 passing**.

**On-chain note:** Testnet engine `0xbdDe…` bytecode **unchanged until redeploy**. Source repo is hardened.

---

## 2. LAR-HIGH-01

**Finding:** `POST /wallet/connect` accepted address without proving wallet ownership.

**Root cause:** Session-only binding in `WalletController::store`.

**Fix:**
- `WalletAuthService::issueWalletLinkNonce` / `verifyWalletLinkSignature` (single-use cache, 5 min TTL, user ID in message).
- `POST /wallet/connect/nonce` (JSON challenge).
- `POST /wallet/connect` requires `address` + `signature` (130 hex).
- Frontend: `resources/js/lib/walletAccountLink.js` — personal_sign then Inertia POST.
- Updated: `Deposit.jsx`, `Swap.jsx`, `RaceToken.jsx`.

**Files:** `app/Services/WalletAuthService.php`, `app/Http/Controllers/WalletController.php`, `routes/web.php`, JS above, `tests/Feature/WalletConnectSecurityTest.php`, `tests/Support/*`

**Business logic:** Wallet still one-time bind; no change to withdrawals/chain rules.

**Tests:** 10 feature cases (auth, valid sign, invalid, wrong wallet, replay, expired, malformed, address-only, already linked). **PHPUnit included in 118 passed.**

---

## 3. LEG-HIGH-01

**Finding:** Legacy `RaceParticipation` testnet contract still reachable via app/indexer fallback.

**Root cause:** `BlockchainContractPayload` fallback to `participation_contract`; indexer watched legacy address; sync service fallback to `RACE_PARTICIPATION_CONTRACT`.

**Fix (application layer — no contract delete, no pause tx executed):**
- `config/participation_contract.php` → `legacy.application_enabled` default **false** (`RACE_LEGACY_PARTICIPATION_ENABLED`).
- `App\Support\LegacyParticipationGuard` — blocks legacy address in sync/indexer when disabled.
- Payload hides legacy contract when disabled; active `contract` = Engine only.
- Indexer drops legacy address unless explicitly enabled.
- `ParticipationOnChainSyncService` uses Engine only; rejects legacy contract.
- `Investment.jsx` — no `participation_contract` fallback for txs.

**On-chain disable (documented, NOT executed):** Owner/MultiSig may call `RaceParticipation.pause()` on testnet `0x9BF2…` to stop new stakes.

**Files:** `app/Support/LegacyParticipationGuard.php`, `config/participation_contract.php`, `BlockchainContractPayload.php`, `ParticipationOnChainSyncService.php`, `IndexBlockchainEventsCommand.php`, `ParticipationOnChainController.php`, `Investment.jsx`, `.env.example`, `tests/Feature/LegacyParticipationDisabledTest.php`

**Business logic:** CommunityEngine economics unchanged.

---

## 4. Compound chain ID

**Finding:** `CompoundTransactionVerifier` rejected all chains except 97 (`chain_not_testnet`).

**Fix:** Allow configured `blockchain.chain_id` **56 or 97** only; invalid/missing → `chain_not_configured`; RPC + receipt checks unchanged.

**Files:** `app/Services/Blockchain/CompoundTransactionVerifier.php`, `tests/Unit/CompoundTransactionVerifierChainTest.php`

---

## Test results

| Suite | Result |
|-------|--------|
| `cd contracts && npm test` (Hardhat) | **141 passed** |
| `php artisan test` | **118 passed**, 16 skipped |

---

## Remaining HIGH (trust / ops — not code-fixed here)

| ID | Item |
|----|------|
| ICO-TRUST-01 | ICO USDT custody = `adminWallet` keys / Safe ops |
| ORACLE-TRUST-01 | Updater/owner can move price within bounds → emission rate |

These are **documented trust assumptions**, not unprivileged exploits.

---

## Remaining MEDIUM (examples)

- Hybrid virtual ledger / admin payout (LAR-MED-03)
- Default mainnet env fallbacks if `.env` wrong (mitigated partly by `BlockchainConfigValidator`)
- Governance whitelist misconfiguration (GOV-MED-01)
- Legacy engine `0xc0D9…` stakes (LEG-MED-01) — separate from Participation app path

---

## Mainnet blockers

1. Redeploy Engine (and optionally document Participation) with **ENG-HIGH-01** bytecode OR accept griefing on old deployment.  
2. ICO `adminWallet` custody policy (Safe / MS).  
3. Oracle ops + multisig runbook.  
4. Virtual ledger reconciliation (M-2 style ops).  
5. Full UAT on target chain ID with compound verify on **56 or 97** as configured.  
6. **`RACE_LEGACY_PARTICIPATION_ENABLED=false`** in production env.

---

## Scorecard

```
CRITICAL_OPEN = 0
HIGH_OPEN     = 2   (ICO adminWallet custody, Oracle trusted role — operational)
MEDIUM_OPEN   = 6+  (see audit register)
LOW_OPEN      = 3+

SECURITY_STATUS = AMBER
```

**Not GREEN** because: (1) live testnet contracts not redeployed for Engine fix; (2) ICO/oracle custody remains centralized trust; (3) medium hybrid/legacy-engine items open.

---

*No deploy, ownership change, claim enable, or fund movement performed in this remediation.*
