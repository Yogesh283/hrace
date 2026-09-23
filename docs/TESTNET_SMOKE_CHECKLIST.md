# Testnet User / Ops Smoke Checklist

Use **tiny** Testnet amounts only. Real funds: never.

| # | Check | Pass criteria |
|---|--------|----------------|
| 1 | Connect wallet | Wallet connects to dApp |
| 2 | chainId 97 | Wrong chain → block tx + “switch to BSC Testnet” |
| 3 | tBNB balance | User has gas for own txs |
| 4 | Test USDT balance | Non-mainnet USDT configured |
| 5 | RACE balance | Readable from deployed RaceCoin |
| 6 | Approval | USDT approve to ICO succeeds |
| 7 | ICO purchase | Tiny buy; USDT↓ supply↑ stake created |
| 8 | Stake creation | Engine stake fields correct |
| 9 | Reward claim | Only when accrual allows |
| 10 | Compound | Only when allowed |
| 11 | Flexible withdraw | Only if ICO completion / rules allow |
| 12 | Fixed maturity | Use Hardhat time tools locally; no production shortcuts |
| 13 | EMI | After maturity path (local time travel / documented test harness) |
| 14 | Governance | Harmless param only; 7 approvals + timelock |
| 15 | MultiSig | Harmless tx; 3-of-5 confirm + execute |

Do not test with treasury drain, arbitrary mint, or user-balance admin writes.
