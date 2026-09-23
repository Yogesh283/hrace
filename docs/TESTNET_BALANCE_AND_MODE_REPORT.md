# Testnet Balance & Mode Report (H-3, H-4, H-5)

**Date:** 2026-09-14

## H-3 — Balance reconciliation

- **Authority (earned income):** `income_wallet_transactions` / `VirtualIncomeWalletService`
- **Audit:** `ledger_entries` (mirror rules in `config/virtual_income_wallet.php`)
- **Deposits:** `user_wallets` / deposit ledger — not virtual income authority
- **Command:** `php artisan income:reconcile-wallets --dry-run` (report only, no mutation)

**Dry-run note:** Many historical users show drift (ledger mirror vs virtual) until optional **M-2 backfill** — expected on dev DB. Pilot users on virtual-wallet path should be reconciled before exit gate #10.

## H-4 — REWARDS_ENGINE UX

- Shared props already expose `blockchain.rewards_engine` / `blockchain_only`
- `VirtualIncomeWallet.jsx` — banner when `blockchain_only`
- `InvestmentController::claimIncome` — structured refusal when `blockchain_only`

## H-5 — RaceParticipation deprecated

- `.env`: `RACE_PARTICIPATION_CONTRACT=` empty, `PARTICIPATION_ON_CHAIN=false`
- Indexer default list: engine + ICO only (participation omitted when blank)
- Legacy address documented in `deployment.json` only (`0x9BF2…`)

## Verification

```powershell
php artisan income:reconcile-wallets --dry-run
php artisan config:show blockchain.rewards_engine
php artisan blockchain:index-events --dry-run
```
