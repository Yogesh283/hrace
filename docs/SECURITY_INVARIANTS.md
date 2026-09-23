# RACE Ecosystem — Security Invariants

**Audit date:** 2026-09-16  
**Scope:** `contracts/src/*`, Laravel bridge, testnet deployment manifest  
**Method:** Static review + Hardhat (`test/security/*`, existing suite)

---

## On-chain invariants (intended)

| ID | Invariant | Enforcement | Test evidence |
|----|-----------|-------------|---------------|
| I-01 | `totalSupply() <= MAX_SUPPLY` (150M × 1e18) | `RaceCoin.mint`, `RaceCoin.governanceMint`, constructor `INITIAL_MINT` | `test/security/RaceMintSupply.test.js`, `RaceCoin.test.js` |
| I-02 | Only `isMinter` addresses may call `RaceCoin.mint` | `onlyMinter` | `RaceMintSupply.test.js` |
| I-03 | Only `engine` may call `RaceRewardVault.pay` | `onlyEngine` | `RaceMintSupply.test.js`, `RaceFinancialSafety.test.js` |
| I-04 | ICO `totalSoldRace <= TOTAL_ALLOCATION` (600k) | `RaceICO.purchase` | `RaceICO.test.js`, `RaceIcoCaps.test.js` |
| I-05 | ICO USDT proceeds go to `adminWallet`, not Engine | `safeTransferFrom(buyer, adminWallet)` | `RaceICO.sol`, indexer `UsdtTransferredToAdmin` |
| I-06 | ICO RACE mint → Engine → `openIcoStake` (buyer wallet not principal) | atomic purchase | `RaceICO.test.js` |
| I-07 | Fixed maturity runs once | `emi.matured` | `RaceMaturityEmi.test.js`, `RaceMaturityReplay.test.js` |
| I-08 | Each EMI slot claimed once | `claimed1/2/3` | `RaceMaturityReplay.test.js` |
| I-09 | `emi1+emi2+emi3 == emiPool == 90% principal` | `matureStake` math | `RaceMaturityEmi.test.js` |
| I-10 | Claim cooldown after successful wallet claim | `lastSuccessfulClaimAt` + `CLAIM_COOLDOWN` | `RaceCommunityEngineClaimPolicy.test.js` |
| I-11 | Claim requires `claimEnabled` + ICO complete (if wired) | `_requireClaimGates` | `RaceCommunityEngineClaimPolicy.test.js` |
| I-12 | Treasury RACE withdraw only from `multisig` address | `RaceTreasury.withdraw` | `RaceMultiSigSecurity.test.js` |
| I-13 | MultiSig requires 3 confirmations | `REQUIRED == 3` | `RaceMultiSigSecurity.test.js` |
| I-14 | Governance executes only `isGovernedTarget` | `RaceGovernance.propose/execute` | `RaceGovernanceHardening.test.js` |
| I-15 | Oracle read rejects stale/zero/out-of-bounds | `racePriceUsdt()` | `RaceRewardPriceOracle` + engine settle tests |

---

## Off-chain invariants (intended)

| ID | Invariant | Status |
|----|-----------|--------|
| I-16 | Virtual compound confirm requires on-chain `RewardCompounded` + sender + stake index | Implemented (`CompoundTransactionVerifier`) — **chain 97 only** |
| I-17 | Virtual ledger idempotency on compound reserve | `VirtualIncomeCompoundService` idempotency_key |
| I-18 | Withdrawal reject restores virtual balance | `WithdrawalService` refund key (H-1) |
| I-19 | Wallet login/register requires signed nonce | `WalletAuthService` |
| I-20 | Same blockchain event must not double-credit virtual income | Partial — depends on idempotency keys + indexer dedup |

---

## Invariants NOT guaranteed (trust / ops)

| ID | Gap |
|----|-----|
| I-T1 | ICO USDT custody = whoever controls `adminWallet` private keys |
| I-T2 | Reward inflation within MAX_SUPPLY if owner/updater lowers oracle price |
| I-T3 | 3/5 MultiSig can repoint `vault.setEngine`, `race.setMinter`, pause protocol |
| I-T4 | Laravel hybrid mode: admin can approve payouts without on-chain proof |
| I-T5 | Legacy `RaceParticipation` on testnet still accepts USDT (parallel module) |
| I-T6 | `/wallet/connect` can bind address without signature (session-bound user) |

---

## Property tests (recommended, not all automated)

- Fuzz: `purchase(usdt, lock)` never exceeds phase + total caps.
- Fuzz: repeated `claimMaturityEmi` never pays more than `emiPoolRace`.
- Fuzz: `totalLockedRace` accounting vs `balanceOf(engine)` (fee-on-transfer edge cases).
- Invariant runner: `sum(mint events) <= MAX_SUPPLY` on forked testnet.

See `docs/SECURITY_AUDIT_REPORT.md` §25 for full list and `test/security/` for executable checks.
