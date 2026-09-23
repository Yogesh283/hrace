# On-Chain Income Specification (Parity Target)

**Rule:** Preserve existing Laravel behavior exactly. No formula changes without explicit approval.

Precision: Laravel wallet income uses **4 dp**; withdrawal fees use **2 dp USD** (`RewardPlan`).

---

## 1. Daily ROI (platform stakes)

**Source:** `IncomePayRoiCommand`, `Investment` model, `config/reward_plan.php` participation rates.

| Input | Description |
|-------|-------------|
| `principal_usd` | Stake principal |
| `daily_rate` | From plan / investment |
| `duration`, caps | Existing payout caps |

**Formula:** `daily_reward = principal × daily_rate` (subject to existing duration/cap rules in command loop).

**Timing:** `next_roi_at` cron eligibility.

**On-chain target:** Merkle or signed batch settlement per payout day referencing `investment_id` + day index as `referenceId`.

---

## 2. Level income (network ROI share)

**Source:** `AffiliateNetworkRoiService`, `LedgerEntry::TYPE_AFFILIATE_NETWORK_ROI`.

**Formula:** Level percent of downline ROI (see `reward_plan` network levels).

**Eligibility:** Active member, tree position — existing Laravel checks.

---

## 3. Team income (virtual withdrawal fee pool)

**Source:** `AffiliateTeamRewardsService::onWithdrawal`.

| Rule | Value |
|------|-------|
| Pool | 10% of withdrawal **gross** |
| L1–L10 weights | 25, 15, 12, 10, 9, 8, 6, 5, 5, 5 (sum 100) |
| Per level | `amount = pool × weight / 100` (2 dp) |
| Unqualified | Remainder → company reserve (admin fee ledger type) |

**On-chain:** `RaceIncomeVault.withdraw` + signed `TeamWithdrawSettlement` payload (already in vault).

---

## 4. Virtual withdrawal fees (USDT-notional)

**Source:** `RewardPlan::calculateWalletWithdrawalFee`, `calculatePayoutAdminFee`.

| Component | Formula |
|-----------|---------|
| Team reward | 10% of gross (2 dp) |
| Admin fee | if gross < $100 → $1; else 1% of gross |
| Net | gross − team − admin |

**On-chain:** `IncomeVaultFeeLib.sol` (implemented).

**Not the same as:** Engine fixed maturity 10% **RACE** fee.

---

## 5. Leadership / R10 / referral credits

**Sources:** respective `IncomePay*` commands, `LedgerWriter`, referral meta levels.

**On-chain target:** Each payout → unique `referenceId` = hash(command, user, period, source_id).

---

## 6. Referral qualification (withdrawal team)

**Source:** `ReferralTree::qualifiesForTeamRewardLevelPayout`, `$50+ active`, direct count per level.

**On-chain target (Phase 7):** Off-chain compute upline payouts → sign `TeamWithdrawSettlement`; optional future Merkle root of qualified uplines per epoch (document trust).

---

## Edge cases (must match Laravel tests)

- Gross $99 → admin $1  
- Gross $100 → admin $1 (threshold `< 100` for flat)  
- Minimum withdrawal $1 (`min_amount_usd`)  
- Reject net ≤ 0  
- Idempotency: same `referenceId` cannot credit twice on vault  

---

## Parity tests required before replacing Laravel authority

- `ClaimVirtualIncomeWithdrawalPolicyTest` fee table  
- `RaceIncomeVaultSecurity.test.js` fee boundary  
- New: Laravel `RewardPlan` vs `IncomeVaultFeeLib` vectors (future Hardhat + PHP data provider)

**Status:** Spec complete; **full on-chain ROI engine not deployed** (Phase 6 ongoing).
