# RaceIncomeVault — security report

**Status:** Implementation complete in repo; **testnet deploy not executed** in this task.

## Contract summary

- **File:** `contracts/src/RaceIncomeVault.sol`
- **Settlement asset:** USDT (BEP20), not RACE
- **Authorization:** EIP-712 typed data, `settlementSigner`
- **Replay:** `referenceId`, `withdrawalId`, `migrationId` mappings
- **Pause:** blocks credit/withdraw; does not drain balances
- **No** `setBalance` / admin confiscation hooks

## Fee policy parity

Matches `RewardPlan::calculateWalletWithdrawalFee` / `calculatePayoutAdminFee`:

- Team reward = **10%** of gross  
- Admin fee = **$1** if gross &lt; $100 else **1%**  
- Net = gross − team − admin  
- Unallocated team share → `adminFeeRecipient` (mirrors unqualified L1–L10 remainder to company reserve)

Team level weights (25/15/12/10/9/8/6/5/5/5) applied **off-chain** in signed `TeamWithdrawSettlement`; on-chain enforces sum ≤ teamReward.

## Hardhat tests

| Suite | Result |
|-------|--------|
| `test/security/RaceIncomeVaultSecurity.test.js` | 20 cases — pass |
| `test/RaceIncomeVaultFuzz.test.js` | 2 cases — pass |

## PHPUnit

| Suite | Notes |
|-------|-------|
| `tests/Feature/OnChainIncomeVaultTest.php` | Signer + authoritative delegation + command registration |

## Outstanding before GREEN

- [ ] Deploy vault testnet + verify BscScan  
- [ ] Wire relayer + liquidity pool funding  
- [ ] Indexer hook for vault events in `blockchain:index-events`  
- [ ] End-to-end UI wallet withdraw tx flow  
- [ ] Migration report reviewed by ops  
- [ ] `income:reconcile-onchain` MATCH on pilot wallets  

## SECURITY_STATUS

**AMBER** — new surface implemented and unit-tested; production/testnet acceptance gates not fully closed (no live deploy).

## MAINNET

**Blocked** — deploy script rejects chainId 56.
