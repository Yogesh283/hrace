# Blockchain Reorg Procedure (Income Vault Index)

## Identity

Events: `(chain_id, tx_hash, log_index)` unique in `on_chain_income_ledger`.

## Detection

1. `income:repair-index` compares stored `blockchain_vault_block_hashes` vs RPC `eth_getBlockByNumber`.
2. On mismatch → cursor rewound to `checkBlock - 1`.
3. Rows with `block_number > newLast` deleted from `on_chain_income_ledger`.
4. Run `income:index-vault` to replay confirmed logs.

## Commands

```bash
php artisan income:repair-index --blocks=20
php artisan income:index-vault
php artisan income:index-vault --repair
php artisan income:reconcile-onchain --json
```

## Rules

- Indexer uses `confirmations` depth before `toBlock`.
- Never overwrite chain balances from Laravel.
- Duplicate ingest → `updateOrCreate` on event identity.
