# TESTNET E2E UAT REPORT

**Date:** 2026-09-13  
**Chain ID:** 97 (BSC Testnet)  
**Redeploy:** NOT executed  
**Mainnet:** NOT EXECUTED  
**RaceMultiSig.sol:** UNCHANGED (3-of-5)  
**Evidence file:** `contracts/deployments/bscTestnet/uat-e2e-results.json`  
**Script:** `npm run uat:testnet-e2e`

**Test user (public):** `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984`  
(Deployer / Testnet ops wallet — private key not printed)

---

## A. Wallet setup

| Check | Result | Evidence |
|-------|--------|----------|
| chainId 97 | PASS | live provider |
| tBNB available | PASS | funded Multisig signers from deployer |
| TEST-USDT balance | PASS | mint/balance via `TestnetMockUSDT` |
| Fund Multisig signers 1–3 | PASS | ~0.02 tBNB each |

---

## B. Token tests (TEST-USDT)

| Check | Result | Evidence |
|-------|--------|----------|
| symbol `TEST-USDT` | PASS | eth_call |
| decimals 18 | PASS | eth_call |
| authorized mint | PASS | owner mint path |
| unauthorized mint blocked | PASS | stranger revert |
| approve + allowance | PASS | tx `0x5db32f003a09027cab24c0dc48e885daa16506da8717cb14c26a4431c8bb3719` |

---

## C. ICO

| Check | Result | Evidence |
|-------|--------|----------|
| `startPhase(1)` via Multisig 3/5 | PASS | confirm#3 `0x4cd4d1d2eaaae0b34e4e3c36dec142a54f676d1e636c0f66fec4d670b451ae6c` → phase=1 |
| Flexible lock rejected on ICO | PASS | staticCall revert |
| `purchase(1 USDT, 180D)` | PASS | tx `0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8` |
| RACE totalSupply +4 | PASS | +`4e18` |
| Engine RACE +4 | PASS | +`4e18` |
| totalSoldRace +4 | PASS | +`4e18` |
| stake created | PASS | stakeCount 0→1 |
| USDT buyer balance delta | **NOTE / PASS*** | Buyer == `adminWallet` (deployer), so `transferFrom` self→self leaves balance unchanged. Payment proven by soldRace/supply/stake. |

\* Automated script initially marked FAIL; corrected after ICO accounting review.

---

## D. Staking

| Field | Expected | Actual | Result |
|-------|----------|--------|--------|
| principalUsdt | 1e18 | 1e18 | PASS |
| stakedRace | 4e18 (@ $0.25) | 4e18 | PASS |
| lockPeriod | 180 days | 15552000 s | PASS |
| dailyRateBps | 50 | 50 | PASS |
| unlockAt > startedAt | true | true | PASS |

---

## E. Claim

| Check | Result | Notes |
|-------|--------|-------|
| pendingRewardUsdt before 1 day | PASS | `0` |
| claim with 0 days owed | PASS** | Contract `_settleAccruedReward` **returns** when `daysOwed==0` (no-op, no mint) — does not revert by design |
| Live multi-day claim + duplicate claim | SKIP | Public Testnet has no time-travel; Hardhat suite covers accrual |

---

## F. Compound

| Check | Result |
|-------|--------|
| compound before accrual | PASS (reverts — compound requires rewardUsdt>0 path) |
| Live accrued compound | SKIP (no time-travel) |

---

## G. Flexible

| Check | Result |
|-------|--------|
| ICO Flexible purchase | PASS (rejected) |
| `participate(FLEX)` before `icoCompleted` | PASS (`engine: flexible after ico only`) |
| Flexible withdraw / Team Reward 10% live | SKIP (`icoCompleted=false`) |

---

## H. Maturity / EMI

| Check | Result |
|-------|--------|
| matureStake + EMI1/2/3 on live chain | SKIP — no production time shortcut; covered by Hardhat `RaceMaturityEmi` tests |

---

## I. Team Reward

| Check | Result |
|-------|--------|
| Live Flexible withdrawal fee path | SKIP (Flexible not unlocked) |
| On-chain fee constant present | INFO — Engine `WITHDRAWAL_FEE_BPS` / `_payTeamRewards` (not exercised live) |

---

## J. Governance

| Check | Result |
|-------|--------|
| Community `RaceGovernance` 10–12 / 7 approvals / timelock | SKIP — **not deployed** on this Testnet |
| Legacy `RaceGovernor` address present | PASS `0xD53De472E9363B5eA08BAF919955B6332575A85D` |

---

## K. MultiSig

| Check | Result | Evidence |
|-------|--------|----------|
| submit `startPhase(1)` | PASS | `0xc3fee6efa6d5ea2e491ef68eae47c0bfc2c6e6b7d923b4172063b56a701c090c` |
| non-signer confirm blocked | PASS | revert |
| duplicate confirm blocked | PASS | revert |
| 3rd confirm auto-executes | PASS | `0x4cd4d1d2…ae6c` |
| threshold still 3 | PASS | |
| RaceMultiSig.sol modified | NO | |

---

## L. Oracle

| Check | Result | Evidence |
|-------|--------|----------|
| price $1/RACE | PASS | `1e18` |
| updater active (ops EOA) | PASS | deployer |
| authorized heartbeat | PASS | `0x2e47da5043bae2b3b95aa526444bbfe5329177a3cab9e74b203716d4a3c38472` |
| unauthorized updater blocked | PASS | revert |
| Distinct from Pancake spot | PASS | `RaceRewardPriceOracle` only |

---

## M. Laravel indexer

| Check | Result |
|-------|--------|
| `RACE_ICO_CONTRACT` / `RACE_COMMUNITY_ENGINE_CONTRACT` match deployment | **FAIL** — Laravel `.env` not wired to Testnet addresses |
| Live indexer soak of ICO/Stake/Oracle events | SKIP (blocked by wiring) |

**Action needed:** set Testnet addresses in Laravel `.env` (`BLOCKCHAIN_NETWORK` / chain 97 / contract addresses from `deployment.json`), enable indexer from deploy block, re-run soak.

---

## N. Frontend

| Check | Result |
|-------|--------|
| Live browser connect / TESTNET label / pages | SKIP — **NOT STARTED** (manual Client UAT) |

---

## O. Failed / open items

1. Laravel Testnet contract wiring — **FAIL**  
2. Frontend live UAT — **NOT STARTED**  
3. Community Governance deploy + proposal/timelock — **not deployed**  
4. Live claim/compound/maturity after real time accrual — **SKIP** (no time-travel)  
5. LiquidityLocker / Pancake LP — not deployed  

---

## P. Known issues / notes

- ICO `adminWallet` currently equals test buyer (deployer) → USDT net balance unchanged on purchase; accounting still correct.  
- `claimReward` with zero accrued days is a silent no-op (by design).  
- Public BSC Testnet cannot simulate 180-day maturity; use Hardhat for EMI proofs.  
- Automated counts in JSON: PASS 47 / FAIL 3 / SKIP 9 — two FAILs are reclassified above as PASS with notes; remaining real FAIL is Laravel wiring.

---

## Q. Key evidence / tx hashes

| Action | Tx |
|--------|-----|
| Multisig submit startPhase | `0xc3fee6efa6d5ea2e491ef68eae47c0bfc2c6e6b7d923b4172063b56a701c090c` |
| Multisig exec startPhase | `0x4cd4d1d2eaaae0b34e4e3c36dec142a54f676d1e636c0f66fec4d670b451ae6c` |
| ICO purchase 1 USDT / 180D | `0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8` |
| Oracle heartbeat | `0x2e47da5043bae2b3b95aa526444bbfe5329177a3cab9e74b203716d4a3c38472` |

Explorer: BscScan Testnet for the above hashes.

---

## Final status

```
TESTNET E2E:
FAIL

CLIENT UAT:
NOT STARTED

MAINNET:
NOT EXECUTED
```

**Meaning:** On-chain core path (config, Multisig, ICO→stake, oracle, Flexible gate) largely **PASS**. Full master-task E2E **FAIL** until Laravel wiring + frontend Client UAT (+ optional Governance deploy / time-based claim-EMI) are completed. Not production ready.
