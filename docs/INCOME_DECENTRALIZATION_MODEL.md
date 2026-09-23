# Income decentralization model

## Asset discovery (pre-implementation)

Inspected `VirtualIncomeWalletService`, `config/virtual_income_wallet.php`, and `docs/CLAIM_VIRTUAL_INCOME_WITHDRAWAL_POLICY.md`.

| Layer | Asset / denomination |
|-------|----------------------|
| Virtual income wallet | **USDT-notional USD** (`asset_default` = USDT) |
| On-chain RACE rewards | **RACE** via `RaceCommunityEngine` / `RaceRewardVault` (separate; unchanged) |
| Settlement for new vault | **BEP20 USDT** configured at deploy (`manifest.usdt` on testnet) |

Income is **accounted in USD terms** off-chain today; on-chain settlement uses the **USDT token** with 18 decimals on project testnet USDT. RACE tokenomics and mint paths are **not** used for this income layer.

## What creates income?

| Step | Location | Notes |
|------|----------|-------|
| ROI / leadership / referral **calculation** | Laravel cron + `LedgerWriter` | Unchanged formulas |
| Virtual wallet **credit** (legacy) | `VirtualIncomeWalletService::credit` | Becomes read-only when `INCOME_VAULT_AUTHORITATIVE=true` |
| On-chain **settlement** | `RaceIncomeVault.creditIncome` | Requires EIP-712 signature from `settlementSigner` |

Label: **off-chain calculation + on-chain settlement**.

## Who authorizes / submits / verifies?

| Role | Responsibility |
|------|----------------|
| **Income settlement signer** (`settlementSigner`) | Signs EIP-712 `CreditIncome` / `MigrateIncome` / `TeamWithdrawSettlement` |
| **Relayer** (any EOA with gas) | Submits signed `creditIncome` / `migrateIncome`; pulls USDT from `incomeLiquidityPool` |
| **User** | Calls `withdraw` from wallet; team ladder requires signed `TeamWithdrawSettlement` |
| **RaceIncomeVault** | Verifies domain (chainId + contract), deadline, reference replay, fee math, balances |
| **Laravel** | Builds payloads (`OnChainIncomeService`), indexes events, UI — **not** authoritative balance when flag enabled |

## ON-CHAIN (RaceIncomeVault)

- Income ledger events (`IncomeCredited`, `IncomeMigrated`)
- Per-user `incomeBalance`
- Withdrawal + fee split (10% team pool + admin fee policy)
- Replay protection (`processedIncome`, `processedWithdrawals`, `processedMigrations`)
- Direct USDT transfer to user net payout

## OFF-CHAIN (still present)

- Income accrual math, referral tree, team qualification (`AffiliateTeamRewardsService`, `ReferralTree`)
- User authentication, admin ops, notifications
- Indexer / read model (`on_chain_income_*` tables)
- Team payout **recipient list** for withdrawals (signed off-chain, enforced on-chain)

## Not claimed

- Fully permissionless reward calculation on-chain
- 100% decentralized referral qualification

## Trust assumptions

- `settlementSigner` key compromise allows fraudulent credits (mitigated by signature + reference idempotency + liquidity pool funding controls)
- `adminFeeRecipient` receives admin fee + unallocated team share (mirrors company reserve behavior)
- `incomeLiquidityPool` must fund credits via allowance
