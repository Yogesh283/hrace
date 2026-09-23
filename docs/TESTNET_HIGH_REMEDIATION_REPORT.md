# Testnet HIGH Remediation Report (H-1, H-2, H-8)

**Date:** 2026-09-14  
**Mainnet executed:** **NO**

## H-1 — Withdrawal reject refund

| Check | Result |
|--------|--------|
| Atomic `DB::transaction` + `lockForUpdate` | **PASS** |
| Idempotency `withdrawal_reject_refund:{id}` | **PASS** |
| Virtual balance restored | **PASS** (`WithdrawalRejectRefundTest`) |

**Files:** `WithdrawalService::reject()`, `VirtualIncomeWalletService::credit()`

## H-2 — Indexer topic mappings

| log (known ICO tx) | Was | Now |
|--------------------|-----|-----|
| MemberRegistered | Unknown | **MemberRegistered** |
| MemberActivated | Unknown | **MemberActivated** |
| ICOPurchase | Unknown | **ICOPurchase** |
| UsdtTransferredToAdmin | Unknown | **UsdtTransferredToAdmin** |

- Updated `IndexBlockchainEventsCommand::resolveEventName()`
- Backfill: `php scripts/backfill-blockchain-event-names.php` → **4 rows** updated
- `php scripts/verify-known-ico-tx.php` → **8 rows, 0 Unknown**

Indexer dry-run now lists **new engine** + **ICO** (participation excluded when env blank).

## H-8 — Chain 97 fail-fast

| Check | Result |
|--------|--------|
| `BlockchainConfigValidator` on boot | **PASS** |
| Testnet + deprecated engine `0xc0D9…` in `.env` | **FAIL fast** (prevented) |
| Testnet + mainnet USDT on chain 97 | **FAIL fast** |
| `.env` `BSC_CHAIN_ID=97` | **PASS** |

**File:** `app/Support/BlockchainConfigValidator.php`, `AppServiceProvider::boot()`

## Verification commands

```powershell
cd c:\xampp\htdocs\Rynexcapital
php artisan test --filter=WithdrawalRejectRefund
php scripts/backfill-blockchain-event-names.php
php scripts/verify-known-ico-tx.php
php artisan config:show blockchain.chain_id
php artisan blockchain:index-events --dry-run
```
