# RACE Fully Decentralized Architecture

**Target:** One reward engine on BSC. Laravel = auth + indexer + analytics only.

## Current state (hybrid — to be removed)

| Layer | Today | Problem |
|-------|-------|---------|
| Placement | **Removed** (contracts + Laravel $10 gate) | — |
| Participation ROI | `IncomePayRoiCommand` cron | Laravel calculates rewards |
| Referrals | `IncomeDispatcher` | Laravel calculates |
| Leadership | `IncomePayCommunityLeadershipCommand` | Laravel calculates |
| Team Rewards | `AffiliateTeamRewardsService` on admin withdrawal approve | Centralized |
| Team Placement matrix | **Removed** with Community Placement | — |
| Contracts | `RaceCommunityEngine`, `RaceParticipation` | Placement / matrix gate removed |
Set `REWARDS_ENGINE=blockchain_only` to disable Laravel ledger credits (see `LedgerWriter` guard).

---

## Target architecture — ONE engine

```
                    ┌─────────────────────────┐
                    │   RaceCommunityEngine  │  ← single member-facing contract
                    │   (facade + registry)    │
                    └───────────┬─────────────┘
        ┌───────────┼───────────┼───────────┬──────────────┐
        ▼           ▼           ▼           ▼              ▼
  (placement     Participation ReferralModule LeadershipModule TeamRewardsModule
   removed)         Module          │              │              │
        └───────────┴───────────────┴──────────────┴──────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │ RaceRewardVault   │  RACE payouts only
                          │ + PancakePrice    │  live USDT→RACE
                          └─────────┬─────────┘
                                    │
                          ┌─────────▼─────────┐
                          │ RaceCoin (BEP20)  │
                          │ PancakeSwap LP    │
                          └───────────────────┘

Laravel ──indexes events──► blockchain_events table ──► Dashboard (read-only)
```

### Reuse from existing `contracts/`

| Contract | Action |
|----------|--------|
| `RaceCoin.sol` | **Keep** — token, 4% fee, DAO mint cap |
| `RaceAutoLiquidity.sol` | **Keep** |
| `RaceTreasury.sol` | **Keep** — multisig |
| `RaceGovernor.sol` | **Keep** — parameter governance |
| `RaceEcosystemVault.sol` | **Keep** |
| `RaceVesting.sol` | **Keep** |
| `RaceLiquidityLocker.sol` | **Keep** |
| `RaceMultiSig.sol` | **Keep** |
| `PancakePrice.sol` (library) | **Keep** — shared price oracle |
| `RacePlacement.sol` | **Removed** — $10 placement / matrix gate deleted |
| `RaceParticipation.sol` | **Keep** (standalone) + logic also in engine |
| `RaceStaking.sol` | **Deprecate** — old emission model |
| `RaceRewardPool.sol` | **Replace** with `RaceRewardVault` — PDF program payouts |
---

## Smart contract modules (Solidity)

### 1. `RaceCommunityEngine.sol` (facade)

- `register(address referrer)` — wallet signup on-chain (`MemberActivated` on first register)
- `participate(usdt, lockPeriod)` — min $1; qualifying ≥ $50; auto-registers if needed (no placement gate)
- `claimReward(stakeIndex)` / `distributeReward(user, stakeIndex)`
- `withdrawStake(stakeIndex)`
- View: `memberStats`, `isParticipationActive`, `stakes`, `pendingRewards`

### 2. Placement — **REMOVED**

- `$10` `purchasePlacement`, matrix, and placement referral payouts are **not** in contracts.
- Use `register(referrer)` then `participate(...)`.

### 3. Participation (merge existing `RaceParticipation`)

- Tiers: 0, 180d, 365d, 730d, 1095d with bps 50, 60, 100, 125, 150
- USDT → RACE swap, lock in contract
- Flexible unstake anytime; fixed after `unlockAt`
- Daily reward: `principalUsdt * bps / 10000` → RACE via Pancake → `transfer` to user
- **Chainlink Automation** or user `claim` (permissionless `distributeReward`)
- Events: `ParticipationPurchased`, `RewardPaid`, `StakeWithdrawn`

### 4. Community Referrals (new on-chain)

- Trigger: `participate()` success
- Walk referral tree 10 levels; rates from immutable `uint16[10] bps`
- Qualification: upline must be self `$50+` participation-active (no N-directs gate)
- Pay RACE via vault + PancakePrice
- Event: `CommunityReferralPaid`

### 5. Community Leadership (new on-chain)

- Immutable rank table (11 ranks)
- Daily cron via **Chainlink Automation** calling `distributeLeadershipForMember`
- Qualification: self stake USDT value, team volume, qualified directs — all on-chain counters
- Pay: **team daily ROI × rank %** (ROI of ROI), not team principal volume
- Pay RACE to qualified wallets
- Events: `LeadershipPaid`, `RankUpdated`

### 6. Community Team Rewards (new on-chain)

- Trigger: `withdrawParticipation(usdtAmount)` on engine — 10% fee stays in contract
- Split fee pool L1–L10 by weights
- Qualification: Level N requires N `$50+` activated directs (unchanged)
- Pay RACE to uplines immediately in same tx
- **No Laravel withdrawal approval**
- Event: `TeamRewardPaid`

### 7. Community Team Placement — **REMOVED**

- On-chain matrix / `$10` placement pool is **not** implemented. Legacy Laravel matrix services are out of scope for the engine.

### 8. `RaceRewardVault.sol`

- Holds RACE funded at deploy from allocation
- Only `RaceCommunityEngine` can `pay(recipient, raceAmount)`
- Governance can `fund()` but not redirect user stakes

---

## Deployment order

1. `RaceMultiSig` (3/5)
2. `RaceCoin`
3. `RaceAutoLiquidity`, `RaceTreasury`, `RaceEcosystemVault`
4. `RaceVesting` (strategic, dev, partnerships)
5. Create RACE/USDT pair on PancakeSwap; `setFeeExempt(pair)`
6. `RaceRewardVault` — fund with program allocation (e.g. 20M RACE)
7. `RaceCommunityEngine` — wire vault, router, USDT, RACE, rank constants
8. `RaceGovernor` — ownership transfer to multisig/governor
9. `RaceLiquidityLocker` — lock LP
10. Verify all contracts on BscScan
11. Laravel `.env`: `REWARDS_ENGINE=blockchain_only`, contract addresses, indexer start block
12. Disable Laravel income crons (automatic when `blockchain_only`)

---

## Blockchain event flow

```
User tx → RaceCommunityEngine
    → emits events
        → BSC RPC eth_getLogs
            → Laravel blockchain:index-events (every minute)
                → blockchain_events table
                    → Dashboard / Transactions / Admin analytics
```

### Events to index

| Event | Dashboard use |
|-------|----------------|
| `MemberRegistered` / `MemberActivated` | Team tree / activation |
| `ParticipationPurchased` | Participation list |
| `RewardPaid` | Daily ROI history |
| `CommunityReferralPaid` | Referral income |
| `LeadershipPaid` | Leadership page |
| `TeamRewardPaid` | Team rewards page |
| `StakeWithdrawn` | Withdrawal history |

> Placement events (`PlacementPurchased`, matrix pays) removed with RacePlacement.

---

## Frontend integration flow

1. **Auth:** WalletConnect / MetaMask → sign message → Laravel session (`WalletAuthController`) — link `users.wallet_address`
2. **Register:** `engine.register(referrer)` (optional; participate auto-registers with `address(0)`)
3. **Participation:** approve USDT → `engine.participate(amount, lockSeconds)` → optional `claimReward(i)` daily
4. **Unstake:** `engine.withdrawStake(i)` when allowed
5. **Withdraw earnings:** On-chain only — no `/withdrawal` Laravel form
6. **Dashboard:** `eth_call` for live pending + `blockchain_events` for history
7. **Remove:** internal deposit, swap virtual RC, `investments.store`, legacy `placement.purchase` POST

### JS modules

- `resources/js/lib/web3Engine.js` — ABI calls to `RaceCommunityEngine`
- `resources/js/lib/web3Usdt.js` — approve helpers (extend `web3Deposit.js`)
- Deprecate `InvestmentRecorder` UI path entirely

---

## Laravel files — REMOVE (after engine live)

### Already removed (Community Placement purge)

- `CommunityPlacementService`, `CommunityPlacementReferralService`, `CommunityTeamPlacementService`
- `GlobalPlacementService`, `BinaryPlacementService`, `PlacementController`
- `RequireCommunityPlacement` middleware / `placement.required`

### Services (delete when fully on-chain)

- `app/Services/Income/CommunityLeadershipService.php` (keep read-only views via RPC)
- `app/Services/Income/IncomeDispatcher.php`
- `app/Services/Income/InvestmentRecorder.php`
- `app/Services/Income/AffiliateTeamRewardsService.php`
- `app/Services/Income/LedgerWriter.php` (or no-op stub)
- `app/Services/Income/WalletBalanceService.php` (remove balance concept)
- `app/Services/Income/RaceCoinService.php` (virtual coin)
- `app/Services/Blockchain/ParticipationOnChainSyncService.php` (replaced by indexer)
- Legacy: `BonzaBusterService`, `AffiliatePlacementService`, `AffiliateNetworkRoiService`

### Commands (delete)

- `IncomePayRoiCommand`
- `IncomePayCommunityLeadershipCommand`
- `IncomePayR10LeadershipCommand`
- `IncomeDemoSeedCommand`, `IncomeSeedMemberTransactionsCommand`

### Controllers (refactor to read-only)

- `InvestmentController` — remove `store()`; Web3 participate only
- `WithdrawalController` — remove (on-chain withdraw)
- `DepositController` — remove credit logic
- `SwapController` — remove virtual swap

### Admin (remove write)

- `AdminDepositScreen`, `UserWalletEditScreen`, `IncomeJobsScreen`, withdrawal approve actions

---

## Laravel files — KEEP / REFACTOR

| File | Role |
|------|------|
| `WalletAuthController` | Auth only |
| `DashboardController` | Read indexed events + RPC views |
| `TeamController`, `DirectTeamController` | Tree from indexed events |
| `LeadershipController`, `RewardsController` | Read-only from chain |
| `LedgerController` → `TransactionsController` | Show `blockchain_events` |
| `IndexBlockchainEventsCommand` | Indexer |
| `BlockchainEvent` model | Storage |
| `config/blockchain.php` | Addresses + mode |
| Orchid analytics screens | Read-only reports |

---

## Security model

| Admin CANNOT | Enforced by |
|--------------|-------------|
| Edit balances | No `user_wallets` writes |
| Pay rewards | No `LedgerWriter` in blockchain_only |
| Unlock stakes | No function in contract |
| Approve withdrawals | No withdrawal table workflow |

| Admin CAN | |
|-----------|---|
| View analytics | Indexed events |
| Pause contracts | `engine.pause()` emergency |
| DAO governance | `RaceGovernor` |

---

## Migration phases

| Phase | Work |
|-------|------|
| **1** | Deploy `RaceCommunityEngine` + vault; `REWARDS_ENGINE=blockchain_only`; indexer |
| **2** | Wire register + Participation UI to engine |
| **3** | On-chain referrals (placement matrix removed) |
| **4** | Leadership + team rewards on withdrawal |
| **5** | Remove Laravel income code; delete `ledger_entries` income types from UI |
| **6** | Chainlink Automation for daily participation + leadership |

---

## Token & price rules

- **Never** `config/race_coin.php` price for rewards
- **Always** `PancakePrice.usdtToRace(router, usdt, race, amount)` at payout time
- RACE transfers use `swapExactTokensForTokensSupportingFeeOnTransferTokens` where needed (fee-on-transfer token)
