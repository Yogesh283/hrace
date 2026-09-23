# RACE Lending & Borrowing — Security Notes

## Contract authority

| Actor | Allowed | Forbidden |
|--------|---------|-----------|
| User | Open own loan (post-ICO), repay/charges on own `positionId` | Repay others’ positions, bypass ICO gate |
| Owner | Pause/unpause, set USDT treasury address | Withdraw user balances, edit positions, force repay |
| Multisig (treasury) | Withdraw USDT from ops treasury via existing fund | N/A from lending contract |
| Lending contract | Pull user-approved USDT, disburse from pre-funded liquidity | Treasury withdraw, mint RACE, Engine writes |

## Controls implemented

- `ReentrancyGuard` on state-changing paths
- `Pausable` (blocks open/repay/charge; not a fund drain)
- `SafeERC20` + zero-address checks
- Amount/product validation (bounded Smart / Pro amounts)
- ICO completion gate (`Lending__IcoNotComplete`)
- Treasury must be contract with matching `usdtToken()`
- Repayment idempotency: `lastRepaymentRef`, `chargePaid`, closed status
- Exact repayment amounts (no over-pull)
- 180-day early principal blocked
- `Lending__BusinessRuleBlocked91To180` — no guessed accrual

## Admin power

**Limited:** pause, unpause, `setUsdtTreasury` (non-arbitrary EOA; validated fund).

**None:** arbitrary loans, confiscation, user position edits, treasury withdrawal hooks.

## User power

Create positions (when enabled), fund repayments with prior USDT `approve`, pay schedule charges when due, settle principal at maturity.

## Tests

Hardhat: `contracts/test/RaceLendingBorrowing.test.js` — 31 scenarios (ICO gate, products, fees, schedules, duplicate/overpay, pause, treasury, events, blocked 91–180).

Run:

```bash
cd contracts && npx hardhat test test/RaceLendingBorrowing.test.js
```

## Deployment

**NOT performed.** Production readiness requires audit, liquidity policy, and ICO-complete mainnet/testnet addresses.
