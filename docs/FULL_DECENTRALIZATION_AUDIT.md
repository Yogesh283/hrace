# Full Decentralization Audit (Phase 0 — Read-Only Baseline)

**Project:** Rynexcapital  
**Path:** `C:\xampp\htdocs\Rynexcapital`  
**Date:** 2026-09-19  
**Scope:** Entire repo — contracts, Laravel, frontend, indexer, cron, admin.

## Executive summary

| Layer | Current authority | Target authority |
|-------|-------------------|------------------|
| RACE stake/claim/maturity/EMI | On-chain (`RaceCommunityEngine`, `RaceRewardVault`) | Unchanged |
| ICO USDT | On-chain → `RaceICO.adminWallet` | Additive treasury/multisig custody (future) |
| Platform USDT income | **Laravel DB** (`VirtualIncomeWalletService`, crons) | **RaceIncomeVault** + indexer |
| Virtual withdraw | Laravel + **admin payout** | User `withdraw()` on vault |
| Income calculation | **Laravel** (`IncomePayRoiCommand`, referral tree) | Spec + verifiable settlement (Phase 6–7) |
| Oracle price | Privileged updater / MultiSig owner | Hardening design (Phase 10) |

**Today:** HYBRID — not fully decentralized.

---

## Financial flow inventory (authority map)

| Flow | Service / contract | DB tables | Current authority | Target |
|------|-------------------|-----------|-------------------|--------|
| ROI accrual/pay | `IncomePayRoiCommand`, `IncomeAccrualService` | `investments`, `ledger_entries` | Laravel | Signed vault credit |
| Level/network ROI | `AffiliateNetworkRoiService` | `ledger_entries` | Laravel | Same |
| Leadership / R10 | `IncomePayCommunityLeadership*`, `IncomePayR10*` | `ledger_entries` | Laravel | Same |
| Virtual credit | `VirtualIncomeWalletService::credit`, `LedgerWriter::mirrorLedgerEntry` | `income_wallet_transactions` | Laravel | Vault `creditIncome` |
| Income claim | `IncomeClaimService` | wallet + ledger | Laravel | Vault after accrual bridge |
| Virtual withdraw | `WithdrawalService` | `withdrawals`, wallet tx | Laravel + admin | Vault `withdraw` |
| Compound | `VirtualIncomeCompoundService` | wallet debit + chain verify | Hybrid | Hybrid (keep) |
| On-chain RACE claim | `RaceCommunityEngine` | `blockchain_events` (read) | Chain | Chain |
| ICO purchase | `RaceICO.purchase` | `ico_purchases` (read) | Chain | Chain |
| Deposit | `DepositController` | ledger | Hybrid verify | Hybrid |
| Admin wallet edit | Orchid `UserWalletEditScreen` | `user_wallets` | **Admin** | Config-only / block when authoritative |
| Demo/seed | `IncomeDemoSeedCommand`, `IncomeSeedMemberTransactionsCommand` | ledger/wallet | **Admin/dev** | Disabled in prod settlement mode |

---

## API / cron capable of financial mutation

| Entry | Mutates balance? |
|-------|------------------|
| `POST /income/claim` | Yes (virtual) |
| `POST /withdrawals` | Yes (virtual debit) |
| `POST /virtual-income/compound/*` | Yes (virtual debit) |
| `income:pay-roi` | Yes (ledger + mirror) |
| Leadership/R10 crons | Yes |
| Orchid withdrawal approve | Yes (ledger + payout workflow) |
| `blockchain:index-events` | Read-only |
| `income:index-vault` | Read-model only |

---

## RaceIncomeVault (source, pre-deploy)

- **Credit:** EIP-712 `settlementSigner` + `referenceId` replay map  
- **Withdraw:** user tx + team settlement signature  
- **Fees:** `IncomeVaultFeeLib` (10% + $1/1%)  
- **Not live** until deploy + `RACE_INCOME_VAULT_CONTRACT` set  

---

## Gaps (priority)

1. Virtual wallet still authoritative (default env).  
2. IncomeVault not deployed (needs `INCOME_VAULT_SETTLEMENT_SIGNER` + deploy confirm).  
3. ROI/referral/team still Laravel-calculated.  
4. Virtual withdrawal admin payout path.  
5. ICO USDT → adminWallet trust.  
6. Oracle updater trust.  
7. Live Engine bytecode vs ENG-HIGH-01 (separate track).  

---

## Phase 0 completion

- **Code modified in Phase 0:** NO (this document only at Phase 0 time).  
- **Next safe phase:** Phase 1 deploy with env + testnet keys.

See `docs/FULL_DECENTRALIZATION_FINAL_REPORT.md` for post-implementation status.
