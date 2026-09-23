# BSC Testnet — Manual Client UAT Report

**Date:** 2026-09-13  
**Environment:** BSC Testnet (chain ID **97**)  
**Manifest:** `contracts/deployments/bscTestnet/deployment.json`  
**Execution mode:** Agent attempted supplementary read-only checks; **MetaMask browser session was not executed by the agent.**

---

## Final status

| Check | Result |
|-------|--------|
| ICO_CLIENT_UAT | **FAIL** |
| RACE_TOKEN_CLIENT_UAT | **FAIL** |
| DASHBOARD_CLIENT_UAT | **FAIL** |
| INDEXER_RECONCILIATION | **FAIL** |
| MAINNET_EXECUTED | **NO** |

**Reason:** User requirement was *manual browser verification with MetaMask*. This agent environment has **no MetaMask / browser wallet access**, so connect/approve/purchase UI steps could not be executed or observed in a live client session. Supplementary automated checks are documented below for context only — they **do not** substitute for browser PASS.

---

## Test context

| Item | Value |
|------|-------|
| Chain ID (configured) | 97 |
| Network | `bsc_testnet` |
| RPC (Laravel `.env`) | `https://data-seed-prebsc-1-s1.binance.org:8545` |
| Prior on-chain UAT wallet (E2E script, not browser) | `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` |
| TestnetMockUSDT | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` (symbol `TEST-USDT`) |
| RaceICO | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| RaceCommunityEngine | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| RaceCoin | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| RaceRewardPriceOracle | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |

### Known prior Testnet transactions (automated E2E — **not** this browser UAT)

| Step | Tx hash | Block |
|------|---------|-------|
| TEST-USDT approve (ICO) | `0x5db32f003a09027cab24c0dc48e885daa16506da8717cb14c26a4431c8bb3719` | 130724687 |
| Phase-1 ICO purchase (1 TEST-USDT, 180D) | `0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8` | 130724727 |
| Multisig `startPhase(1)` exec | `0x4cd4d1d2eaaae0b34e4e3c36dec142a54f676d1e636c0f66fec4d670b451ae6c` | 130724712 |

On-chain reconciliation (read-only RPC, block 130724727): receipt **success**, `to` = RaceICO, **2–4 logs** observed depending on RPC endpoint. Prior E2E recorded stake `principalUsdt=1e18`, `stakedRace=4e18`, `lockPeriod=15552000` (180D), `dailyRateBps=50`.

---

## 1. `/ico` — Manual checklist

| Step | Result | Evidence / error |
|------|--------|------------------|
| Connect wallet (MetaMask) | **NOT EXECUTED** | Agent has no browser wallet |
| Verify BSC Testnet / chain 97 in wallet UI | **NOT EXECUTED** | — |
| Verify TEST-USDT balance in UI | **NOT EXECUTED** | — |
| Approve TEST-USDT | **NOT EXECUTED** | Prior E2E approve tx exists (see above); not verified in browser this session |
| Execute small Phase-1 ICO purchase | **NOT EXECUTED** | Prior E2E purchase tx exists; not verified in browser this session |
| Verify transaction in wallet / explorer | **NOT EXECUTED** | — |
| Verify RaceICO → RaceCommunityEngine staking | **NOT EXECUTED** (browser) | On-chain E2E: stake count 0→1, engine RACE increased |
| Verify user stake/principal in UI | **NOT EXECUTED** | — |

**Supplementary (non-browser):** HTTP fetch of `/ico` without auth returns **Login** page, but shared Inertia `blockchain` props show `chain_id=97`, `is_testnet=true`, `ico_contract` and `usdt` match deployment.json. **Does not satisfy ICO client UAT.**

**ICO_CLIENT_UAT: FAIL**

---

## 2. `/race-token` — Manual checklist

| Step | Result | Evidence / error |
|------|--------|------------------|
| Connect wallet | **NOT EXECUTED** | — |
| Verify RACE / TEST-USDT data in UI | **NOT EXECUTED** | — |
| Verify no Mainnet chain/addresses selected | **NOT EXECUTED** (wallet) | Config props: `chain_id=97`, USDT ≠ mainnet `0x55d398…7955`, router not checked in UI |

**Supplementary (non-browser):** Shared props on login redirect show Testnet addresses only in Laravel config payload. Wallet `ensureBscNetwork()` wiring exists in frontend (`web3Deposit.js` + Inertia sync) but **not exercised in browser**.

**RACE_TOKEN_CLIENT_UAT: FAIL**

---

## 3. Dashboard — Manual checklist

| Step | Result | Evidence / error |
|------|--------|------------------|
| Verify wallet/account data | **NOT EXECUTED** | Route requires authentication; no logged-in browser session |
| Verify indexed blockchain state | **NOT EXECUTED** (UI) | DB empty (see indexer section) |
| Verify no duplicate/stale ICO/stake data | **NOT EXECUTED** (UI) | DB: `ico_purchases=0`, `blockchain_events=0`, duplicate rows `0` |

**DASHBOARD_CLIENT_UAT: FAIL**

---

## 4. Indexer reconciliation

| Check | Result | Detail |
|-------|--------|--------|
| Laravel indexer run | **FAIL** | `php artisan blockchain:index-events` → `eth_getLogs failed` on default RPC (rate/limit errors on binance seed endpoints) |
| `ico_purchases` rows | **0** | Expected ≥1 after known ICO tx `0xd6a8025…` |
| `blockchain_events` rows | **0** | Expected ICO / engine events |
| `blockchain_index_state` | **empty** | Indexer never advanced |
| Duplicate ICO rows | **0** | N/A — nothing indexed |
| On-chain vs DB match | **FAIL** | On-chain purchase confirmed; Laravel DB has no matching indexed record |

**Suggested fix (config only, no business logic):** point `BSC_RPC_URL` to a Testnet endpoint with higher `eth_getLogs` limits (e.g. `https://bsc-testnet.publicnode.com`), reduce `BLOCKCHAIN_INDEXER_BATCH`, re-run `php artisan blockchain:index-events`, then re-test Dashboard `/ico` indexed purchases.

**INDEXER_RECONCILIATION: FAIL**

---

## Commands executed (read-only / diagnostic)

```powershell
cd c:\xampp\htdocs\Rynexcapital
php artisan serve --host=127.0.0.1 --port=8000
php scripts/client-uat-db-check.php
php scripts/client-uat-inertia-check.php
php scripts/client-uat-rpc-check.php
php artisan blockchain:index-events   # failed eth_getLogs on default RPC
```

```powershell
cd c:\xampp\htdocs\Rynexcapital\contracts
node scripts/client-uat-onchain-check.js   # timeout on default RPC during this session
```

---

## Blockers for PASS

1. **Manual MetaMask browser session required** — agent cannot perform connect/approve/sign flows.
2. **Authenticated session required** — `/ico`, `/race-token`, `/dashboard` redirect to login without user session.
3. **Indexer not synced** — Dashboard and `/ico` indexed purchase lists will stay empty until indexer succeeds on a suitable RPC.
4. **No contract redeploy** — all checks use existing deployment addresses only.

---

## Safety confirmations

- No Solidity contracts redeployed.
- No Mainnet chain ID or Mainnet USDT/router used in Laravel config.
- No business logic modified during this UAT attempt.
- No private keys printed or committed.

---

## Next steps (human tester)

1. Login at `http://127.0.0.1:8000/login` (or deployed URL).
2. Connect MetaMask → **BSC Testnet (97)**.
3. Ensure wallet holds **TEST-USDT** (`0xE30F…fEc`) and tBNB for gas.
4. Repeat ICO checklist on `/ico`; record tx hashes in this doc.
5. Update `BSC_RPC_URL` if needed; run `php artisan blockchain:index-events`; confirm `/ico` `indexed_purchases` and Dashboard reflect on-chain data.
6. Re-run this checklist and change status lines to PASS only where browser steps succeed.
