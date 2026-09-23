# Income Migration Runbook (NOT EXECUTED BY DEFAULT)

## States

| Status | Meaning |
|--------|---------|
| PENDING | Snapshot in `income_migration_plans` |
| SIGNED | EIP-712 payload stored |
| SUBMITTED | Relayer broadcast `migrateIncome` |
| CONFIRMED | Event `IncomeMigrated` indexed |
| FAILED | Tx or validation failed |
| RECONCILED | `income:reconcile-onchain` MATCH |

## Steps (operator)

1. `php artisan income:migration-report`
2. Per user: `IncomeMigrationPlanner::snapshotUser()` (via future artisan command or tinker — **no auto batch in prod**)
3. Build signed payload — **do not commit private keys**
4. Submit `migrateIncome` on testnet only
5. `php artisan income:index-vault`
6. `php artisan income:reconcile-onchain --json`
7. Only after zero critical mismatch: consider `INCOME_VAULT_AUTHORITATIVE=true` (separate approval)

## Idempotency

- On-chain: `processedMigrations[migrationId]`
- Off-chain: unique `migration_id` in `income_migration_plans`
