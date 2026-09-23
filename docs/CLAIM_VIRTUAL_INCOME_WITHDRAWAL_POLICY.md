# Claim, Virtual Income & Withdrawal Policy

Platform (Laravel) staking income — **not** on-chain `RaceCommunityEngine` RACE claims.

## Summary

| Action | Moves money | Admin Fee | Team Reward |
|--------|-------------|-----------|-------------|
| **Accrual** (`income:pay-roi`) | Stake → accrued bucket | No | No (network-of-ROI still runs on accrual) |
| **Claim** (`POST /income/claim`) | Accrued → virtual USDT wallet | **No** | No |
| **Withdraw** (`WithdrawalService`) | Virtual wallet → off-platform BEP20 | **Yes** | **Yes** (10% of gross) |

Reward **formulas** (daily %, caps, schedules) are unchanged. ICO pricing and staking principal are unchanged.

## Accrual

- Cron/command: `php artisan income:pay-roi`
- Uses existing participation ROI math (`principal × daily_rate`, duration caps, flexible rules).
- Credits **`investments.accrued_reward_usd`** and audit ledger `roi_accrual` (does **not** change withdrawable wallet).
- If the member skips days, the pay loop still processes every due day in one run — accrued totals **accumulate** until claimed (subject to existing payout caps).

## Claim

- Route: `POST /income/claim` (`investments.claim` / `income.claim`).
- Service: `App\Services\Income\IncomeClaimService`.
- Moves **all** accrued USD from platform stakes into the member **virtual income** wallet (`user_wallets.balance_usd`).
- Ledger: `income_claim` — **no** `withdrawal_admin_fee` row.
- Cooldown: `config('income.claim.interval_hours')` (default 24h) from `users.last_income_claim_at`.
- Disabled when `participation_contract.on_chain.enabled` or `blockchain_only` — use on-chain claim there.

## Virtual income

- Authoritative balance: `WalletBalanceService` / `user_wallets.balance_usd`.
- Sum of wallet-affecting ledger types only (`LedgerEntry::walletBalanceEntryTypes()`).
- Members may accumulate multiple claims before withdrawing.

## Withdrawal (off-platform)

- Service: `App\Services\Income\WithdrawalService` (server-side fees only — client cannot override).
- **Gross** amount debited from virtual wallet on admin approval.
- **Team Reward** = 10% of gross → Community Team Rewards L1–L10 (existing rules).
- **Admin Fee** (cash-out, separate from stake-unlock 10%):
  - gross **&lt; $100** → **$1** flat
  - gross **≥ $100** → **1%** of gross
- **Net payout** = gross − Team Reward − Admin Fee.

### Examples

| Gross | Team (10%) | Admin Fee | Net |
|------:|-----------:|----------:|----:|
| $50 | $5.00 | $1.00 | $44.00 |
| $99 | $9.90 | $1.00 | $88.10 |
| $100 | $10.00 | $1.00 | $89.00 |
| $500 | $50.00 | $5.00 | $445.00 |

Admin Fee is recorded once per withdrawal (`WithdrawalService::ADMIN_FEE_SOURCE`).

## UI

- **Staking** (`/investment`, platform mode): Accrued reward, Virtual income, Claim button.
- **Withdrawal** (`/withdrawal`): Accrued (info), Virtual income, gross form with Team Reward + Admin Fee + **Net withdrawal** preview.

## Config

- `config/income.php` — claim interval.
- `config/reward_plan.php` → `community_team_rewards.wallet_withdrawal_fee` — Team + Admin fee rules.

## Tests

- `tests/Feature/ClaimVirtualIncomeWithdrawalPolicyTest.php`

## On-chain note

Engine / ICO RACE claims mint or transfer on BSC; this document covers **USDT virtual income** on Laravel only. No contract redeploy required for this policy.
