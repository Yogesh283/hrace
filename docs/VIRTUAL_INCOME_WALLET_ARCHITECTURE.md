# Virtual Income Wallet — Architecture

## Pre-change impact list (inspection summary)

| Area | Current state | Impact of this refactor |
|------|---------------|-------------------------|
| **`ledger_entries` + `user_wallets`** | Authoritative USDT balance via `LedgerWriter`; many income types credit wallet directly | **Kept** for audit/back-office; **Virtual Income Wallet** is now authoritative for earned-income balance via `income_wallet_transactions` |
| **`income:pay-roi`** | Accrues to `investments.accrued_reward_usd` + `roi_accrual` ledger | **Unchanged formulas**; claim still required before virtual credit |
| **`IncomeClaimService`** | Moves accrued → ledger `income_claim` | **Mirrors** to virtual wallet (`income_claim` type); **no Admin Fee** |
| **`WithdrawalService`** | Team Reward + Admin Fee on gross; ledger on approve | Balance check uses **virtual wallet**; **gross debit** at request with idempotency `withdrawal_request:{id}`; fees unchanged |
| **`AffiliateTeamRewardsService`** | Credits uplines on withdrawal | Upline credits still via `LedgerWriter`; **mirrored** as `team_income` in virtual wallet |
| **Level / network ROI / leadership** | Various `LedgerWriter` entry types | **Mirrored** to `level_income`, `team_income`, `referral_income`, etc. |
| **`CompoundStakeService`** | Platform reinvest from wallet | Uses **virtual balance**; debits mirrored as `compound` |
| **On-chain Engine claim/compound** | MetaMask + contracts; indexer for stakes | **Unchanged**; virtual wallet **does not** replace on-chain RACE balances |
| **`blockchain_events` / stake indexer** | Staking positions, ICO stakes | **No merge** with virtual ledger (explicit separation) |
| **ICO virtual Race Coin** | `user_wallets.race_coin_balance` | **Separate** from USDT virtual income wallet |
| **Deposits (`wallet_deposit`)** | Credits `user_wallets` only | **Not** mirrored to virtual income (not “earned income”) |
| **Frontend** | Split labels on Investment / Withdrawal | **Unified** page `/virtual-income` + clearer “Virtual Income Wallet” labeling |
| **Mainnet** | Env-driven | **No contract deploy**; Laravel-only ledger + existing payout flow |
| **Tests** | Policy + withdrawal tests | Extended; PHPUnit forces `REWARDS_ENGINE=hybrid` for platform income tests |

---

## Data model

### Table: `income_wallet_transactions`

| Column | Purpose |
|--------|---------|
| `user_id` | Owner |
| `wallet_address` | Snapshot at write time (optional) |
| `type` | `daily_reward`, `level_income`, `team_income`, `referral_income`, `income_claim`, `compound`, `withdrawal`, … |
| `source_reference` | e.g. `investment:12`, `withdrawal:9`, `ledger:404` |
| `amount` | Decimal(20,4) — **always positive**; direction determines sign |
| `asset` | Default `USDT` (notional) |
| `direction` | `credit` \| `debit` |
| `status` | `posted` (default), `pending`, `failed` |
| `idempotency_key` | Unique per user — prevents double claim/compound/withdraw |
| `metadata` | JSON (ledger link, fees, tx_hash, stake_index, …) |

### Balance (authoritative)

```
available = sum(credits posted) − sum(debits posted)
```

Implemented with **bcmath** in `VirtualIncomeWalletService` (no float accounting).

Legacy `user_wallets.balance_usd` remains for deposits / investment debits until fully split in UI.

---

## Income sources → wallet `type`

Configured in `config/virtual_income_wallet.php` (`ledger_type_map`).

| Source (ledger `entry_type`) | Wallet `type` |
|------------------------------|---------------|
| `income_claim`, `roi_daily`, `roi_monthly` | `income_claim` / `daily_reward` |
| `community_leadership`, `affiliate_network_roi`, … | `level_income` |
| `community_team_reward` | `team_income` |
| `community_referral`, `referral_direct`, … | `referral_income` |
| `compound_reinvest` | `compound` (debit) |
| `stake_unlock_emi` | `stake_unlock_emi` (credit) |

**Excluded from mirror:** `wallet_deposit`, `investment_debit`, `withdrawal_admin_fee`, `stake_unlock_admin_fee`, `roi_accrual`, `wallet_withdrawal` (withdrawal debited explicitly in `WithdrawalService`).

---

## Claim flow

1. `income:pay-roi` accrues (formula unchanged) → `accrued_reward_usd`.
2. User `POST /income/claim` (`IncomeClaimService`) — 24h policy unchanged.
3. Credits `ledger_entries` (`income_claim`) + **mirrors** virtual wallet.
4. **No** Admin Fee, **no** on-chain mint per accrual day.

---

## Compound flow

### Platform compound (existing)

`CompoundStakeService` debits virtual balance (via mirrored `compound_reinvest` ledger).

### On-chain compound (new API)

1. `POST /virtual-income/compound/reserve` — validates balance, **debit once** (`idempotency_key`).
2. User executes **single** authorized on-chain compound/mint (frontend/engine — unchanged contracts).
3. `POST /virtual-income/compound/confirm` — attaches `tx_hash` (idempotent).

Mint happens **only** on user compound — not on income credit.

---

## Withdrawal flow

1. Validate **virtual** balance ≥ gross.
2. Server computes Team Reward + Admin Fee (`RewardPlan::calculateWalletWithdrawalFee`) — **client cannot override**.
3. Create `withdrawals` row (unchanged).
4. **Debit virtual wallet** (gross) with idempotency `withdrawal_request:{id}`.
5. Admin approval → existing ledger `wallet_withdrawal` (company payout pipeline unchanged).

Admin Fee: gross &lt; $100 → $1; gross ≥ $100 → 1%. Team Reward: 10% of gross.

---

## Transaction boundaries

- All virtual mutations run inside `DB::transaction` with `users` row `lockForUpdate`.
- Idempotency keys enforce: no double debit on retry.
- `LedgerWriter` mirrors wallet-affecting rows after legacy ledger write (try/catch — mirror failure logged, does not silent-fail ledger).

---

## Idempotency

| Action | Key pattern |
|--------|-------------|
| Ledger mirror | `ledger_entry:{id}` |
| Withdrawal request | `withdrawal_request:{withdrawal_id}` |
| Compound reserve | Client-supplied `idempotency_key` |
| Compound confirm | Same row + unique `metadata.tx_hash` |

---

## Blockchain vs off-chain

| Concern | Source of truth |
|---------|------------------|
| Virtual USDT income balance | Laravel `income_wallet_transactions` |
| Stake positions, pending RACE on-chain | BSC contracts + indexer |
| Minted RACE / compound tx | Chain tx receipt |
| Admin Fee / Team Reward on cash-out | Laravel `WithdrawalService` |

Frontend must label **Virtual Income Wallet** — not “Wallet RACE Balance” unless chain balance is shown separately.

---

## Security model

- Balance and fees: **server-only** (`VirtualIncomeWalletService`, `WithdrawalService`, `RewardPlan`).
- Frontend previews are display-only.
- `blockchain_only` / on-chain participation modes: platform claim/compound endpoints rejected where already enforced.

---

## Migration impact

1. Run migration `2026_09_14_140000_create_income_wallet_transactions_table.php`.
2. **New rows** populate via mirror on future ledger writes.
3. Optional backfill (not auto-run): replay production `ledger_entries` through `VirtualIncomeWalletService::mirrorLedgerEntry()` for historical parity.
4. Existing business rules (ROI %, Team Reward ladder, Admin Fee, claim interval) **unchanged**.

---

## Related docs

- `docs/CLAIM_VIRTUAL_INCOME_WITHDRAWAL_POLICY.md` — claim vs withdraw fee policy
- `docs/CLAIM_ACTIVATION_24H_POLICY.md` — on-chain Engine claim gates (separate)

## Tests

- `tests/Feature/VirtualIncomeWalletArchitectureTest.php`
- `tests/Feature/ClaimVirtualIncomeWithdrawalPolicyTest.php`
- `tests/Feature/WithdrawalTeamRewardTest.php`

---

## UI routes

- `GET /virtual-income` — unified balance + history
- `POST /income/claim` — accrual → virtual wallet
- `GET /withdrawal` — off-platform payout (fees on withdraw only)
