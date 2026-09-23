# Full Financial Authority Map

Read-only classification of money-moving flows. **No behavior changed** by this document.

| # | Flow | Service / contract | DB | Current authority | Future authority | Idempotency | Chain tx |
|---|------|-------------------|-----|-------------------|------------------|-------------|----------|
| 1 | ROI accrual | `IncomeAccrualService`, `IncomePayRoiCommand` | `investments`, `ledger_entries` | Laravel | Signed `creditIncome` | cron day + investment id | No |
| 2 | Level ROI share | `AffiliateNetworkRoiService` | `ledger_entries` | Laravel | Signed credit | ledger ref | No |
| 3 | Leadership / R10 | `IncomePayCommunityLeadership*`, `IncomePayR10*` | `ledger_entries` | Laravel | Signed credit | period keys | No |
| 4 | Virtual wallet credit | `VirtualIncomeWalletService::credit` | `income_wallet_transactions` | Laravel | Vault | `idempotency_key` | No |
| 5 | Ledger mirror | `LedgerWriter` → mirror | wallet tx | Laravel | Indexer mirror only | `ledger_entry:{id}` | No |
| 6 | Income claim | `IncomeClaimService` | ledger + wallet | Laravel | Vault `income_claim` type | claim cooldown | No |
| 7 | Virtual withdraw request | `WithdrawalService::request` | wallet debit + `withdrawals` | Laravel | Vault `withdraw` | withdrawal id | No |
| 8 | Withdraw approve/payout | `WithdrawalService::approve` | ledger | Admin + Laravel | On-chain USDT | withdrawal id | Optional manual |
| 9 | Team on withdraw | `AffiliateTeamRewardsService` | ledger | Laravel | Signed team settlement | withdrawal id | No |
| 10 | Compound reserve | `VirtualIncomeCompoundService` | wallet debit | Laravel + chain verify | Hybrid | idempotency_key | Yes |
| 11 | Engine RACE claim | `RaceCommunityEngine` | `blockchain_events` | Chain | Chain | stake index | Yes |
| 12 | ICO purchase | `RaceICO.purchase` | indexer | Chain | Chain | purchaseId | Yes |
| 13 | Platform deposit | `DepositController` | ledger | Hybrid verify | Hybrid | tx hash | Yes |
| 14 | Admin wallet deposit | `UserWalletEditScreen` | ledger | Admin | Config / separate | admin ref | No |
| 15 | Demo seed income | `IncomeSeedMemberTransactionsCommand` | ledger | Dev only | Blocked when authoritative | — | No |
| 16 | Vault credit | `RaceIncomeVault.creditIncome` | `on_chain_income_*` | Chain (when live) | Chain | `referenceId` | Yes |
| 17 | Vault withdraw | `RaceIncomeVault.withdraw` | index | Chain | Chain | `withdrawalId` | Yes |
| 18 | Vault migrate | `RaceIncomeVault.migrateIncome` | index | Chain | Chain | `migrationId` | Yes |

**Guards (when `INCOME_VAULT_AUTHORITATIVE=true`):** `VirtualIncomeWalletService`, `LedgerWriter` income types, ROI cron, seed command, optional legacy withdraw via `INCOME_VAULT_LEGACY_WITHDRAWAL`.
