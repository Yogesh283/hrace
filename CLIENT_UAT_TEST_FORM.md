# Race Network — Client Testnet UAT Form

**Site:** https://racenetwork.live  
**Network:** BSC Testnet · Chain ID **97**  
**Currency gas:** tBNB · **Stake token:** TEST-USDT `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc`

> Private keys / seed phrase **kabhi mat likho**. Sirf public address (`0x…`) aur tx hash.

---

## A) Tester info

| Field | Fill |
|-------|------|
| Client / Company name | |
| Tester name | |
| Date (start) | |
| Date (end) | |
| Phone / Email | |
| Device (Chrome / Mobile) | |
| MetaMask version (optional) | |

---

## B) Wallets used (public addresses only)

| Role | MetaMask account | Address (0x…) | tBNB OK? | TEST-USDT balance |
|------|------------------|---------------|----------|-------------------|
| **A** Sponsor | | | Yes / No | |
| **B** Direct of A | | | Yes / No | |
| **C** Direct of B (optional) | | | Yes / No | |
| Admin (optional) | | | Yes / No | |

---

## C) Test checklist — fill PASS / FAIL / SKIP

Har row: **Status** + **Tx hash** (BscScan Testnet) + short **Notes**.

| # | Flow | Who | What to do | Expected | Status | Tx hash | Notes |
|---|------|-----|------------|----------|--------|---------|-------|
| 01 | Wallet connect | A | Site open → Connect → BSC Testnet | Connected, chain 97 | | | |
| 02 | Import TEST-USDT | A | Import token (address above) | Token visible | | | |
| 03 | Approve USDT | A | Stake/ICO se pehle Approve | MetaMask success | | | |
| 04 | A qualify stake | A | Stake / ICO **≥ $50** | Stake created | | | |
| 05 | B register under A | B | Referrer = **A** | Profile linked to A | | | |
| 06 | B stake (L1 referral) | B | Stake **≥ $50** (better $100) | A gets **~3% RACE** referral | | | |
| 07 | Check A referral | A | Wallet / reward / history | ~3% of B principal | | | |
| 08 | C small stake | C | Stake **$10** ($1–$49) | C ROI path OK; **no** referral pay | | | |
| 09 | C qualify under B | C | Stake **≥ $50**, referrer B | B ~3% L1; A may get L2 ~1% | | | |
| 10 | Claim ROI | A or B | **≥ 1 day** baad Claim | RACE to wallet | | | |
| 11 | Compound | A or B | Compound button | Principal up, no cash out | | | |
| 12 | Flex withdraw | A | Flexible exit (if available) | **90%** user / **10%** team | | | |
| 13 | Laravel USDT withdraw $50 | any | Withdraw request **$50** | Team 10% + admin **$1** | | | |
| 14 | Laravel USDT withdraw $100+ | any | Withdraw **$100** or **$500** | Team 10% + admin **1%** | | | |
| 15 | Wrong chain | any | Ethereum/BSC Mainnet try | Site/wallet switch or block | | | |
| 16 | Admin panel | Admin | `/admin` login | Opens, no crash | | | |

**Status codes:** `PASS` · `FAIL` · `SKIP` (reason notes mein)

---

## D) Bug report (sirf FAIL pe — copy paste)

```text
TEST ID:          (01–16)
FLOW:             
WALLET ROLE:      A / B / C
ADDRESS (public): 0x
INPUT (amount):   
EXPECTED:         
ACTUAL:           
TX HASH:          
SCREENSHOT:       Yes / No
CHAIN ID:         97 (must)
SEVERITY:         P0 Critical / P1 High / P2 Medium / P3 Low
DATE/TIME:        
```

---

## E) Final sign-off

| Question | Answer |
|----------|--------|
| Kitne tests PASS? | ___ / 16 |
| Kitne FAIL? | |
| Kitne SKIP? | |
| Referral (A←B) verified? | Yes / No |
| Ready for next stage? | Yes / No / With issues |
| Client signature / name | |
| Date | |

**Overall comment:**

```
(yahan likho — kya theek tha, kya nahi)
```

---

## F) Quick cheat sheet (client)

1. MetaMask → **BSC Testnet (97)**  
2. Faucet se **tBNB**  
3. Ops se **TEST-USDT** mint  
4. **A ≥ $50** → **B under A ≥ $50** → A pe **3% referral** check  
5. Tx hash → https://testnet.bscscan.com  

**Minimum complete test:** rows **01–07** (2 users A+B).  
**Full income smoke:** rows **01–14** (3 users A+B+C).
