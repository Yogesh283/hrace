# Race Coin — BSC Smart Contracts

Decentralized RACE token ecosystem for PancakeSwap (BSC), aligned with the whitepaper.

## Token

| Property | Value |
|----------|--------|
| Name | Race Coin |
| Symbol | RACE |
| Decimals | 18 |
| Total supply | **5 CR** = 50,000,000 RACE |
| Transfer fee | **4%** (1% each: auto-LP, treasury, reward pool, dev) |
| Governance mint cap | **1% of supply per month** (DAO only) |

## Token allocation (deploy script)

| Bucket | Amount | Destination |
|--------|--------|-------------|
| Liquidity | 5M | Deployer (manual PancakeSwap LP) |
| Strategic reserve | 2.5M | 12-month vesting (multisig beneficiary) |
| Development fund | 2.5M | 6-month cliff + 24-month linear vesting |
| Ecosystem growth | 7.5M | `RaceEcosystemVault` (DAO releases) |
| Staking rewards | 20M | `RaceRewardPool` |
| Treasury reserve | 10M | `RaceTreasury` (multisig withdrawals) |
| Partnerships | 2.5M | 12-month vesting |

## Contracts

| Contract | Purpose |
|----------|---------|
| `RaceCoin.sol` | ERC20 + 4% fee + governance mint cap |
| `RaceStaking.sol` | Register (optional referral), flexible / 30 / 90 / 180-day stake, 10-level income |
| `RaceRewardPool.sol` | 20M pool — daily rewards (30-day backlog) + level payouts |
| `RaceTreasury.sol` | 10M reserve + fee share — **3/5 multisig** withdrawals only |
| `RaceAutoLiquidity.sol` | 1% fee → swap half to USDT → add RACE/USDT LP |
| `RaceMultiSig.sol` | 3-of-5 multisig for treasury & vesting releases |
| `RaceVesting.sol` | Cliff + linear or fixed-lock vesting |
| `RaceEcosystemVault.sol` | 7.5M ecosystem fund — releases via `RaceGovernor` |
| `RaceGovernor.sol` | DAO: stake-weighted propose / vote / timelocked execute (3-day vote, 1-day delay, 5% quorum) |
| `RaceLiquidityLocker.sol` | 5-year PancakeSwap LP token lock |
| `RaceCommunityEngine.sol` | Community rewards engine — register, participate, referrals, leadership, team rewards |
| `RaceParticipation.sol` | **Decentralized Participation** — USDT → RACE stake, daily rewards from Pancake price |
| `RaceRewardVault.sol` | RACE payout vault for engine rewards |

> **Note:** `$10` Community Placement (`RacePlacement`) and the on-chain matrix gate have been **removed**. Participation no longer requires placement.

## Participation Program (`RaceParticipation.sol`)

Fully decentralized. Laravel does **not** calculate participation ROI when `PARTICIPATION_ON_CHAIN=true`.

| Tier | Lock | Daily rate |
|------|------|------------|
| Flexible | 0 | 0.50% |
| 180 Days | 180d | 0.60% |
| 365 Days | 365d | 1.00% |
| 730 Days | 730d | 1.25% |
| 1095 Days | 1095d | 1.50% |

**Flow**

1. `participate(usdtAmount, lockPeriod)` on `RaceParticipation` (min **50 USDT**). No placement required.
2. Contract swaps USDT → RACE via **PancakeSwap** and locks RACE principal.
3. `claimReward(stakeIndex)` or permissionless `distributeReward(user, stakeIndex)` — daily RACE paid at live DEX price.
4. `withdrawStake(stakeIndex)` — flexible anytime; fixed tiers after lock expires.

**Admin cannot:** change user rewards, withdraw user stakes, unlock early, or edit balances.

**Events:** `ParticipationPurchased`, `StakeCreated`, `RewardPaid`, `RewardClaimed`, `StakeWithdrawn`.

Fund the reward vault: `fundRewardVault(amount)` with RACE (5M allocated on deploy).

## Staking (legacy `RaceStaking`)

| Lock | Duration |
|------|----------|
| Flexible | Withdraw anytime (`lockPeriod = 0`) |
| Short | 30 days |
| Medium | 90 days |
| Long | 180 days |

Level income on stake (from reward pool): L1 5%, L2 2%, L3 1%, L4–5 0.5%, L6–10 0.25%.

## User flow (on-chain)

1. `register(referrer)` — referrer optional (`address(0)`)
2. Buy RACE on PancakeSwap (USDT pair)
3. `stake(amount, lockPeriod)` — ID active; staking contract is fee-exempt
4. `claimDailyReward()` — daily mining; missed days accumulate up to **30 days**
5. Level income paid to active upline on each stake
6. `unstake(stakeIndex)` — after lock (or anytime for flexible)
7. Wallet-to-wallet transfers — 4% fee
8. `processLiquidity()` on auto-LP when balance ≥ minimum

## Governance

- `RaceGovernor` controls fee recipients, daily emission, ecosystem vault releases (via proposals).
- Treasury and vesting beneficiary = multisig — no single-owner drain.
- Production: transfer `Ownable` roles to multisig / governor timelock after audit.

## Setup

```bash
cd contracts
npm install
npm run compile
npm test
```

## Deploy (BSC testnet)

```bash
copy .env.example .env
# DEPLOYER_PRIVATE_KEY=...
# MULTISIG_SIGNERS=0x...,0x...,0x...,0x...,0x...  (exactly 5 addresses)
npm run deploy:testnet
```

Optional env:

- `PANCAKE_ROUTER` — default BSC mainnet router
- `USDT` — default BSC USDT
- `LP_TOKEN` — deploy `RaceLiquidityLocker` immediately after pair exists

After deploy:

1. Add **RACE/USDT** liquidity on PancakeSwap from deployer balance (5M RACE).
2. `raceCoin.setFeeExempt(pairAddress, true)` so DEX buys/sells are not double-taxed.
3. Send LP tokens to `RaceLiquidityLocker` (or redeploy locker with `LP_TOKEN`).
4. Transfer contract ownership to multisig for mainnet.

## Mainnet addresses (fill after deploy)

| Contract | Address |
|----------|---------|
| RaceCoin | |
| RaceMultiSig | |
| RaceTreasury | |
| RaceStaking | |
| RaceParticipation | |
| RaceCommunityEngine | |
| RaceRewardVault | |
| RaceRewardPool | |
| RaceAutoLiquidity | |
| RaceGovernor | |
| RaceEcosystemVault | |
| Strategic / Dev / Partnerships Vesting | |
| RaceLiquidityLocker | |
| RACE/USDT Pair | |

## Notes

- Laravel indexes `ParticipationPurchased` for community referrals only — rewards are on-chain.
- PancakeSwap router (BSC mainnet): `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- USDT BEP20: `0x55d398326f99059ff775485246999027b3197955`
- Audit required before mainnet launch.
