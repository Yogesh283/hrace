# Income migration report

Run to regenerate from live DB (no automatic migration):

```bash
php artisan income:migration-report
```

## Purpose

Compare **legacy virtual** balance (`VirtualIncomeWalletService::sumBalance`) vs **indexed on-chain** balance (`on_chain_income_balances`) per wallet.

## Columns

| Column | Meaning |
|--------|---------|
| Legacy virtual balance | Sum of posted `income_wallet_transactions` (historical authority) |
| On-chain indexed balance | Sum from `IncomeCredited` / `IncomeMigrated` − `IncomeWithdrawal` events |
| Difference | Legacy − on-chain |
| Status | `aligned` or `migration_pending` |

## Migration path

Use `RaceIncomeVault.migrateIncome` with EIP-712 `MigrateIncome` signature — emits **`IncomeMigrated`** (not `IncomeCredited`). Do not fabricate historical chain events.

## Initial state (before deploy / index)

All wallets: on-chain indexed balance **0** until vault deployed and migration settlements executed.

**Existing stakes / RACE claims:** unaffected — this report covers **USDT virtual income** only.
