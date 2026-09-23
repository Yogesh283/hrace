# RACE Lending & Borrowing — Product Specification

## Scope

Isolated module: `contracts/src/RaceLendingBorrowing.sol`. **Does not** modify `RaceCommunityEngine`, `RaceICO`, `RaceTreasury` (RACE), or tokenomics.

```
LENDING_CONTRACT_CREATED=YES
DEPLOYMENT=NO
```

## ICO start gate

- Lending enabled only when `IRaceIcoCompletion(raceIco).icoCompleted() == true`.
- `isLendingEnabled()` = ICO complete **and** not paused.
- No Laravel flag as financial authority.

## Product 1 — Smart Lending

| Field | Rule |
|--------|------|
| Amount | 100–499 USDT (18 decimals) |
| Duration | 7 days (`dueTime = start + 7d`) |
| Security | 20% → `RaceOperationsTreasury` (via `deposit`) |
| Disbursement | 80% USDT to user from contract liquidity |
| Repayment | Full 80% principal to treasury via `repaySmartLending` |
| `productType` | `SmartLending` |
| `repaymentOption` | `None` |

## Product 2 — Smart Pro Lending

| Field | Rule |
|--------|------|
| Amounts | **500** or **1000** USDT only |
| Security | 30% → treasury |
| Disbursement | 70% USDT to user |
| Program window | 180 days (`programEndTime`) |
| Options | 30 / 90 / 180 day repayment paths |

### 30-day path

- Schedule charge: **50 USDT** at day 30 (`payProScheduleCharge`, index `0`).
- Principal due day 30: `repaySmartProPrincipal` (full 70% disbursement).

### 90-day path

- Charges: **50 + 50 + 50 USDT** at days 30, 60, 90 (indices 0–2).
- Principal due day 90.

### 180-day path

- **No** periodic 50 USDT charges.
- Principal due day 180 only.
- **Early principal repayment reverts** (`Lending__RepaymentTooEarly`).

## 91–180 day income rule

**BLOCKED:** `accrueProIncomeDays91To180()` always reverts `Lending__BusinessRuleBlocked91To180`. Exact income formula not defined in repository — no on-chain guess.

## RACE position (Engine integration)

**Selected: Option B** — `racePositionNotional = selectedAmount` stored on-chain in the lending contract for indexer/UI. **RaceCommunityEngine is not called** (no approved lending→engine API without core changes). Future: multisig-governed linker or proof-based settlement off-chain.

## Treasury / USDT flow

1. User approves USDT to `RaceLendingBorrowing`.
2. Security: `transferFrom` user → lending → `IRaceFundDeposit.deposit(USDT)`.
3. Disbursement: contract liquidity → user.
4. Repayments/charges: `transferFrom` user → lending → treasury `deposit`.
5. Contract **cannot** call treasury `withdraw` (Multisig-only).

`RaceTreasury.sol` holds **RACE** only; USDT uses `RaceOperationsTreasury` / `RaceMultisigFund` pattern.

## Position storage

Unique `positionId`, fields: user, amounts, times, status, productType, repaymentOption, charge bitmap, `racePositionNotional`.

## Laravel

Read-only: `config/race_lending.php`, `RaceLendingReadService`, `RaceLendingEventDecoder`, `on_chain_lending_positions` migration. No balance authority.

## Unresolved business rules

- Return of security to user on successful close (currently security is **non-refundable** treasury inflow).
- Late repayment / grace after `dueTime` before `recordDefault`.
- Exact 91–180 “income” allocation beyond treasury routing.
