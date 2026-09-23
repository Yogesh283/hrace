# Decentralization Internal Security Report

## Static search summary

| Area | Finding |
|------|---------|
| Private keys in repo | `contracts/.env` contains deployer key — **operational risk**; never commit; rotate if exposed |
| Hardcoded signer | None in Solidity vault (configurable `settlementSigner`) |
| DB balance mutation | `LedgerWriter`, `VirtualIncomeWalletService`, Orchid wallet edit |
| Guards added | `IncomeVaultFinancialAuthority` on wallet post, ledger income types, ROI cron, seed, withdraw when authoritative |
| Idempotency | Vault `referenceId`, wallet `idempotency_key`, index `(chain_id, tx_hash, log_index)` |
| Signature domain | EIP-712 name/version/chainId/contract in vault + PHP signer |

## Tests run

- Hardhat `RaceIncomeVaultSecurity.test.js` — 20 pass
- PHPUnit decentralization + authority + indexer duplicate tests

## Open (requires deploy)

- Live vault bytecode verification
- End-to-end credit/withdraw UAT

**INCOME_VAULT_AUTHORITATIVE:** remains **false** by design.
