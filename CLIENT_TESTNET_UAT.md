# CLIENT TESTNET UAT — Rynexcapital / Race Network

**Status:** Local Hardhat green · Testnet contracts **reused** (no new deploy) · Automated UAT `FAIL=0`  
**Date prepared:** 2026-09-23  
**Do not put private keys or seed phrases in this file.**

---

## 1. Testnet name

BSC Testnet (Chapel)

## 2. Chain ID

`97`

## 3. Frontend URL

Production mirror for client UI: `https://racenetwork.live`  
(Server path: `/var/www/racenetwork.live` — ensure `.env` points to **testnet** contracts below while UAT is active.)

Local: `http://localhost` (XAMPP) with same contract env.

## 4. Admin panel URL

`{APP_URL}/admin` (Orchid)

## 5. Contract addresses (existing deployment — do not redeploy)

Source: `contracts/deployments/bscTestnet/deployment.json`

| Contract | Address |
|----------|---------|
| RaceMultiSig (3-of-5) | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| RaceCoin | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| RaceTreasury | `0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A` |
| RaceRewardVault | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| RaceCommunityEngine | `0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef` |
| RaceICO | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| RaceRewardPriceOracle | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| RaceParticipation (legacy) | `0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5` |
| RaceStaking | `0xA31C053767034C86BaB132B53686AAb7898255A3` |
| RaceGovernor (legacy) | `0xD53De472E9363B5eA08BAF919955B6332575A85D` |

## 6. Token / USDT address

| Token | Address |
|-------|---------|
| TEST-USDT (18 decimals) | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| Pancake Router (testnet) | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` |

## 7. Test wallet requirements

Prepare **four** MetaMask wallets on BSC Testnet (chain 97):

| Role | Purpose |
|------|---------|
| ADMIN | Ops / mint TEST-USDT if authorized / Orchid admin login |
| USER A | Sponsor (referrer) — stake `$50+` first |
| USER B | Direct of A — ICO/participate `$100` |
| USER C | Direct of B (optional L2 tests) |

Fund each with testnet **BNB** for gas (faucet).

## 8. How to obtain testnet funds

1. BNB: public BSC Testnet faucets (search “BSC testnet faucet”).  
2. TEST-USDT: authorized minter (deployer ops) or project admin mints to client wallets — never share private keys.

## 9. How to connect wallet

1. MetaMask → Add network BSC Testnet (chainId `97`).  
2. Open frontend → Connect Wallet.  
3. Confirm site shows testnet / correct chain.

## 10. How to approve USDT

1. Before ICO or `participate`, approve TEST-USDT for `RaceICO` and/or `RaceCommunityEngine`.  
2. Amount: at least purchase/stake size.

## 11. How to purchase / stake

**ICO (fixed locks only):** `RaceICO.purchase(usdtAmount, lockSeconds)`  
Locks: 180d / 365d / 730d / 1095d (Flexible **rejected** on ICO).

**Post-ICO Engine:** `RaceCommunityEngine.participate(usdtAmount, lockPeriod)`  
Flexible only after `icoCompleted == true`.

RACE principal stays **in Engine**, not free in buyer wallet.

## 12. How to test referral

1. USER A registers, then stakes **≥ $50** (qualifying).  
2. USER B registers with A as referrer, stakes **≥ $50**.  
3. Expect L1 community referral **3%** of principal (RACE via RewardVault) on stake open.  
4. `$1–$49`: personal ROI only — **no** referral activation pay.

## 13. How to test claim

1. Wait ≥ 1 day of accrual (or use Hardhat time travel in local tests).  
2. `claimEnabled` must be true; ICO complete gate may apply.  
3. Call `claimReward(stakeIndex)` — 24h cooldown between successful claims.  
4. Public testnet: live multi-day accrual often **SKIP** in automated UAT (no time warp).

## 14. How to test compound

`compoundReward(stakeIndex)` — increases principal; does not pay wallet. Same gates/oracle as claim.

## 15. How to test withdrawal

**On-chain flexible:** `withdrawStake` → 10% RACE team fee to uplines, 90% to user.  
**On-chain fixed:** `matureStake` → 10% treasury + EMI 30/30/rest.  
**Laravel virtual income USDT:** request withdrawal → Team Reward 10% (L1–L10 weights) + Admin fee ($1 if gross &lt; $100 else 1%) → net to BEP20 after approve.

## 16. Known time-dependent tests

| Flow | Automated UAT |
|------|----------------|
| Live 1-day claim/compound | SKIP on public testnet |
| Maturity + EMI 1/2/3 | SKIP (covered by Hardhat) |
| Flexible after ICO complete | SKIP until `icoCompleted` |
| Oracle stale until heartbeat | Ops Multisig/updater must refresh |

## 17. Expected results (business rules — unchanged)

- Referral: 3% / 1% / 1% / 0.5% / 0.25%×6  
- Daily rates: Flex=35bps (0.35%), 180=50, 365=70, 730=90, 1095=100  
- Flexible exit team fee: 10% RACE (weights 25…5)  
- Laravel withdraw team: 10% of gross, same L1–L10 weights; unqualified → admin unallocated ledger  
- Admin fee: $1 (&lt;$100) or 1% (≥$100)  
- Royalty Rank 11: Laravel monthly (~$5000) — not on Engine

## 18. Known limitations

- `RaceIncomeVault` **not** in testnet `deployment.json` (Engine uses `RaceRewardVault` mint path).  
- Buyer may equal ICO `adminWallet` → USDT self-transfer (balance delta 0); raisedUsdt still increases.  
- Oracle can go **stale**; claim/compound need fresh price.  
- Community RaceGovernance (10–12) not in this manifest.  
- Manual browser UAT and indexer soak not automated.

## 19. Transaction verification

1. Copy tx hash from wallet / UAT log.  
2. Open [BscScan Testnet](https://testnet.bscscan.com).  
3. Confirm: status success, contract = addresses above, events (`ICOPurchase`, `ParticipationPurchased`, `RewardPaid`, etc.).

Automated results file (ops):  
`contracts/deployments/bscTestnet/uat-e2e-results.json`

## 20. Bug reporting format

```text
TEST ID:
FLOW:
USER ROLE / ADDRESS (public only):
INPUT:
EXPECTED:
ACTUAL:
TX HASH:
SCREENSHOT / LOG:
CHAIN ID (must be 97):
SEVERITY (P0–P3):
```

---

## Client checklist (fill during UAT)

| TEST ID | FLOW | USER | INPUT | EXPECTED | ACTUAL | TX HASH | STATUS |
|---------|------|------|-------|----------|--------|---------|--------|
| UAT-001 | Wallet connect | A/B/C | chain 97 | Connected | | | |
| UAT-002 | Approve TEST-USDT | B | ICO/Engine | Allowance ≥ amount | | | |
| UAT-003 | ICO purchase 180d | B | ≥$1 USDT | Stake in Engine | | | |
| UAT-004 | Referral L1 | B→A | $100 qualify | A gets ~3% RACE | | | |
| UAT-005 | $1–$49 path | C | $10 | ROI yes, referral no | | | |
| UAT-006 | Claim ROI | B | after 1d | RACE to wallet | | | |
| UAT-007 | Compound | B | | Principal up | | | |
| UAT-008 | Flexible withdraw | A | Flex plan | 90% user / 10% team | | | |
| UAT-009 | Mature + EMI | B | Fixed unlock | Treasury 10% + EMI | | | |
| UAT-010 | Laravel withdraw | A | $50 / $100 / $500 | Dual fees | | n/a ledger | |
| UAT-011 | Rank 11 royalty | Admin cron | month hold | Monthly bonus | | n/a | |

---

## Ops: automated verification (2026-09-23)

```text
LOCAL Hardhat:     198 PASS / 0 FAIL
LARAVEL filters:   38 PASS / 0 FAIL
TESTNET UAT:       46 PASS / 0 FAIL / 12 SKIP
DEPLOYMENT:        reused bscTestnet deployment.json (no new deploy)
MAINNET DEPLOY:    NO
SECRETS IN DOCS:   NO
BUSINESS LOGIC:    NO (test fixtures + UAT assertions only)
```

Run again:

```bash
cd contracts && npx hardhat test && npm run uat:testnet-e2e
cd .. && php artisan test --filter=CommunityReferral
php artisan test --filter=CommunityLeadership
php artisan test --filter=WithdrawalTeamReward
php artisan test --filter=ClaimVirtualIncome
php artisan test --filter=RoiPay
```
