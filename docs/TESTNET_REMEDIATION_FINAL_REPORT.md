# Testnet Remediation — Final Report

**Date:** 2026-09-14  
**Scope:** Batches 1–6 (Batch 7 browser UAT not fully executed in automation)  
**Mainnet executed:** **NO**

---

## Ticket results

| ID | Result | Evidence |
|----|--------|----------|
| **C1** | **PASS** | `docs/TESTNET_C1_ENGINE_REMEDIATION_REPORT.md`, live RPC, `deployment.json` |
| **C2** | **PASS** | Verifier + refund FSM, PHPUnit |
| **H1** | **PASS** | `WithdrawalRejectRefundTest` |
| **H2** | **PASS** | 8/8 known ICO tx events named, 0 Unknown |
| **H3** | **PARTIAL** | `income:reconcile-wallets --dry-run` exists; historical drift on dev DB |
| **H4** | **PARTIAL** | UI banner + backend refusal; ops doc in `.env.example` still recommended |
| **H5** | **PASS** | Participation removed from indexer/env |
| **H6** | **PASS** | `php artisan test` → **101 passed**, 16 skipped, **0 failed** |
| **H8** | **PASS** | Boot validator, `BSC_CHAIN_ID=97` |
| **H9** | **PASS** | Same as C-1 — `claimEnabled()` live on `0xbdDe…` |

---

## Testnet exit gate (10 criteria)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Live Engine `claimEnabled` eth_call | **PASS** |
| 2 | ICO + Vault engine match manifest | **PASS** |
| 3 | Known ICO tx 0 Unknown (8 logs) | **PASS** |
| 4 | Compound failed hash refund + valid confirm | **PASS** (unit); live tx **NOT RUN** |
| 5 | Withdrawal reject restores balance | **PASS** |
| 6 | PHPUnit 0 failures | **PASS** |
| 7 | Hardhat 132+ pass | **PASS** (132) |
| 8 | Chain 97 fail-fast | **PASS** |
| 9 | REWARDS_ENGINE UI/mode | **PARTIAL** |
| 10 | Reconcile 0 critical drift (pilot) | **FAIL** (35 drift rows on full DB dry-run) |

---

## TESTNET_EXIT

**AMBER** — Core C-1/C-2/H-1/H-2/H-8 green; full **GREEN** blocked by reconciliation backfill (gate #10), live compound UAT (#4), and manual Batch 7 browser UAT.

---

## Findings open

| Severity | Count | Notes |
|----------|------:|-------|
| **CRITICAL** | **0** | C-1/C-2 addressed on testnet/code |
| **HIGH** | **1** | Historical virtual/ledger drift until backfill (H-3 ops) |
| **MEDIUM** | **2** | Claim `setClaimEnabled` not toggled; Batch 7 UAT incomplete |

---

## MAINNET_EXECUTED

**NO**

---

## TOP follow-ups (not auto-applied)

1. MultiSig `setClaimEnabled(true)` after ICO complete on **new** engine.  
2. `income:backfill-virtual-wallet` (M-2) then re-run reconcile for pilot users.  
3. Batch 7 manual browser UAT + live compound tx.  
4. `npm run build` after frontend banner change.

---

## Related docs

- `docs/TESTNET_C1_ENGINE_REMEDIATION_REPORT.md`
- `docs/TESTNET_C2_COMPOUND_VERIFICATION_REPORT.md`
- `docs/TESTNET_HIGH_REMEDIATION_REPORT.md`
- `docs/TESTNET_BALANCE_AND_MODE_REPORT.md`
