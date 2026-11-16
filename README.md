# RACE Network (Rynexcapital)

**Live site:** [https://racenetwork.live](https://racenetwork.live)  
**Chain:** BNB Smart Chain (BSC Mainnet, Chain ID **56**)  
**Token:** RACE (BEP-20)

Yeh project **on-chain RACE token + community rewards + ICO** ko ek Laravel/React web app ke saath jodta hai. Paisa aur RACE ownership blockchain par rehti hai; website mainly wallet login, UI, history, indexing aur admin ke liye hai.

---

## 1. Project kya karta hai (simple)

1. User **Trust Wallet / MetaMask** se site kholta hai.
2. Wallet **BNB Smart Chain (56)** par confirm hota hai.
3. Wallet connect + signature se **login / register** hota hai.
4. User **ICO** se USDT dekar RACE kharid sakta hai.
5. User **Participation / Investment** se stake karke daily ROI, referral aur leadership income dekh sakta hai.
6. Income / withdraw flows jahan designed hain **on-chain contracts** ke through jaate hain.
7. Admin panel se ICO phases, Multisig actions, members aur support manage hota hai.

**Important rule:** Final RACE ownership **virtual DB balance se prove nahi hoti** — real on-chain RACE matter karti hai. Laravel index/history/UI dikhata hai.

---

## 2. Locked tokenomics (final — change mat karo)

| Bucket | Amount |
|--------|--------|
| **MAX_SUPPLY** | **150,000,000** RACE (15 Crore) |
| **ICO** | max **600,000** RACE (6 Lakh) |
| **Expense** (Marketing / Dev / Extra) | **30,000,000** RACE (3 Crore) via **3-of-5 Multisig** |
| Remaining | **119,400,000** RACE — naye buckets auto-create mat karo |

### Must preserve

- Mint hamesha `totalSupply <= MAX_SUPPLY`
- Unlimited / hidden / admin backdoor mint nahi
- ICO bucket income emission se alag; expense Multisig se alag
- Multisig **3-of-5** (single-owner treasury nahi)
- BSC mainnet; Laravel = index / history / UI only for ownership
- Income formulas / business rules bina explicit instruction change mat karo

`RaceCoin.sol` mein `MAX_SUPPLY = 150_000_000 ether` aur `EXPENSE_ALLOCATION = 30_000_000 ether` locked hain.

> **Note:** Purane docs (`contracts/README.md` etc.) mein kabhi 50M dikh sakta hai — woh outdated hai. **Is project README ke locked numbers follow karo.**

---

## 3. Architecture (kaise layers milte hain)

```
┌─────────────────────────────────────────────────────────────┐
│  User: Trust Wallet / MetaMask / TokenPocket (DApp Browser) │
└───────────────────────────┬─────────────────────────────────┘
                            │ wallet_switch → eth_chainId 56
                            │ personal_sign (SIWE) after 56 only
┌───────────────────────────▼─────────────────────────────────┐
│  Frontend (React + Inertia + Vite)                          │
│  Pages: Login, Dashboard, ICO, Investment, Swap, Team…      │
│  Wallet libs: web3Wallet / web3Deposit / web3Auth / Gate    │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP + session cookie
┌───────────────────────────▼─────────────────────────────────┐
│  Backend (Laravel + Orchid Admin)                           │
│  Auth, ledger history, cron income jobs, event indexer      │
│  Admin: ICO setup, Multisig helpers, members, support       │
└───────────────────────────┬─────────────────────────────────┘
                            │ RPC / events / tx sync
┌───────────────────────────▼─────────────────────────────────┐
│  BSC Smart Contracts                                        │
│  RaceCoin · RaceICO · CommunityEngine · Multisig · Hold…    │
└─────────────────────────────────────────────────────────────┘
```

### Hybrid reality (aj kal)

Kuch rewards abhi Laravel cron/services se calculate / ledger me dikhte hain; kuch on-chain Engine / Participation / Hold contracts par hain. Long-term direction: **blockchain engine primary**, Laravel = auth + indexer + analytics (`contracts/DECENTRALIZED_ARCHITECTURE.md`).

---

## 4. Tech stack

| Area | Tech |
|------|------|
| Backend | Laravel (PHP), Orchid admin |
| Frontend | React 18, Inertia.js, Vite 7, Tailwind |
| Blockchain | Solidity, Hardhat (`contracts/`) |
| Chain | BSC Mainnet `56` (testnet `97` possible via env) |
| Wallet | Injected EIP-1193 / EIP-6963 (Trust, MetaMask, TokenPocket…) |
| Swap | PancakeSwap V2 router (custom swap contract nahi) |

---

## 5. Important folders

```
Rynexcapital/
├── app/                      # Laravel: Controllers, Services, Models, Orchid admin
│   ├── Http/Controllers/     # Dashboard, ICO, Swap, Auth, Withdrawal…
│   ├── Services/             # Income + Blockchain indexer services
│   └── Orchid/               # Admin screens
├── resources/js/
│   ├── Pages/                # React pages (Isu = ICO, Dashboard, Swap…)
│   ├── Components/           # Wallet gate, auth button, UI pieces
│   ├── hooks/                # useWalletNetwork
│   └── lib/                  # web3Wallet, web3Deposit, web3Auth, web3RaceICO…
├── config/
│   ├── reward_plan.php       # Referral / ROI / leadership rules
│   └── race_coin.php         # Display/fallback price helpers
├── contracts/
│   ├── src/                  # Solidity contracts
│   ├── scripts/              # Deploy / verify scripts
│   └── test/                 # Hardhat tests
├── routes/web.php            # Member routes
├── deploy.md                 # Production deploy notes
└── public/build/             # Vite production assets (server pe npm build se)
```

---

## 6. Main smart contracts (live roles)

| Contract | Kaam |
|----------|------|
| **RaceCoin** | BEP-20 RACE, max supply 150M, fee, controlled mint |
| **RaceMultiSig** | 3-of-5 approvals (expense / admin owner actions) |
| **RaceICO / ICO** | Phased token sale (USDT → RACE) |
| **RaceCommunityEngine** | Register, participate, community reward facade |
| **RaceParticipation** | Stake tiers / daily rewards path |
| **RaceIncomeHold** | Income hold / withdraw related flow |
| **RaceRewardVault** | Reward payout vault |
| **RaceTreasury** (+ marketing/dev/ops) | Treasury buckets |
| **RaceGovernor** | Stake-weighted governance proposals |
| **RaceStaking / RewardPool** | Legacy staking paths (deprecate direction) |
| **RaceAutoLiquidity** | Fee → LP helper |

### Live mainnet addresses (see also `.env.example` / `deploy.md`)

| Name | Address |
|------|---------|
| RaceCoin | `0xa29683442d9221Df0Eb7AFF3932c1E165FFa93EB` |
| Multisig (3-of-5) | `0x81BffBF2C2a258E662e9df0a0f6e34150b33F3df` |
| Race ICO | `0x631C12254A98cC69516859fD43c4Da494F5073CA` |
| ICO contract | `0xc618bc4f36877F5d81539f7275958f4B21677d27` |
| ICO admin wallet (USDT receive) | `0x568B11c83A104c81c70cde58cCdbF4aa9c97b225` |
| Community Engine | `0x93E75234026aA3942624Dd61Dc4EF2aCf958E1DE` |
| Participation | `0x0cbBb4d3871343AB25EAe2A707956DC4E5779821` |
| Income Hold | `0x5D1576349C994656Cc15C28106C73bc6535bcb33` |
| Official USDT (BSC) | `0x55d398326f99059ff775485246999027b3197955` |
| Pancake Router V2 | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |

---

## 7. ICO kaise chalata hai

- Phases (typical): **Phase 1 $0.25 · Phase 2 $0.35 · Phase 3 $0.45** (200k RACE each style allocation — ICO cap overall locked).
- User ICO page (`/ico` → React `Isu.jsx`) se wallet connect karta hai.
- USDT approve + buy on-chain; Laravel purchase index/history sync karta hai.
- Phase complete / next phase start aksar **owner = Multisig** se hota hai (admin Multisig submit/confirm UI).
- Cap full / leftover dust se buy fail ho sakta hai — pehle phase complete, phir next start.

---

## 8. Community rewards (business rules snapshot)

Source of truth for app rules: `config/reward_plan.php` (+ PDF where referenced).

### Participation tiers (app config)

| Tier | Daily reward % (config) |
|------|-------------------------|
| Flexible | 0.35% |
| 180 Days | 0.50% |
| 365 Days | 0.70% |
| 730 Days | 0.90% |
| 1095 Days | 1.00% |

Min qualifying stake often **$50+**. Unlock fee rules (10% / EMI) `reward_plan.php` mein hain.

### Community referral (one-time on qualifying stake)

| Level | % |
|-------|---|
| L1 | 3% |
| L2–L3 | 1% |
| L4 | 0.50% |
| L5–L10 | 0.25% |

Upline usually self **$50+ active** hona chahiye.

### ROI sharing

Direct sponsor ko downline daily ROI ka **10%** (L1 only) — config `roi_sharing`.

### Leadership

Ranks / team volume rules `reward_plan.php` + leadership pages / cron commands.

---

## 9. Wallet / Trust Wallet flow (critical)

Trust Wallet DApp Browser mein **browser menu network ≠ injected `eth_chainId`** ho sakta hai.

App ab yeh karta hai:

1. Trust provider detect: `window.trustwallet` / Trust-flagged `window.ethereum`
2. Connect par real provider se `eth_chainId` padho
3. Agar 56 nahi → `wallet_switchEthereumChain`
4. Chain missing (error **4902**) → tabhi `wallet_addEthereumChain`
5. Switch ke baad poll until `eth_chainId === 56` (ya timeout)
6. **SIWE / `personal_sign` tabhi** jab chain 56 confirm ho
7. Cancel ≠ successful login
8. Gate UI: Detecting → Current network → Switching → Waiting → Connected / Retry
9. Diagnostic: provider name + chain id + `window.ethereum` / `window.trustwallet`

Key files:

- `resources/js/lib/web3Wallet.js`
- `resources/js/lib/web3Deposit.js`
- `resources/js/lib/web3Auth.js`
- `resources/js/lib/walletNetworkSession.js`
- `resources/js/Components/WalletNetworkGate.jsx`

---

## 10. Member pages (UI map)

| URL / page | Purpose |
|------------|---------|
| `/` | Landing |
| Login / Register | Wallet SIWE auth |
| `/dashboard` | Member overview |
| `/ico` | ICO buy |
| `/investment` | Stake / participation |
| `/deposit` | Deposit flows |
| `/swap` | Swap / ID activation helpers |
| `/team`, `/direct-team` | Network |
| `/leadership`, `/rewards` | Rank / rewards |
| `/withdrawal`, `/transactions` | Cash-out / ledger |
| `/governance` | Governance UI |
| `/admin` (Orchid) | Admin panel |

---

## 11. Local development

### Requirements

- PHP + Composer (Laravel)
- Node.js + npm
- MySQL / configured DB
- Optional: Hardhat for contracts

### App

```bash
composer install
cp .env.example .env
php artisan key:generate
# .env me DB + BSC addresses set karo
php artisan migrate
npm install
npm run dev
php artisan serve
```

### Frontend production build

```bash
npm install
npx vite build
# or: npm run build
```

### Contracts

```bash
cd contracts
npm install
npx hardhat test
```

---

## 12. Production deploy (racenetwork.live)

Server path (typical):

```text
/home/racenetwork/htdocs/racenetwork.live
```

### Safe deploy of a feature branch (example)

```bash
cd /home/racenetwork/htdocs/racenetwork.live
git fetch origin
git checkout fix/ico-wrong-network-message
git pull origin fix/ico-wrong-network-message
npm install
npx vite build
php artisan optimize:clear
```

### Notes

- Apex host par `SESSION_DOMAIN` **empty** rakho (TokenPocket/Trust CSRF 419 avoid).
- `vite: not found` aaye to pehle `npm install`, phir `npx vite build`.
- `main` diverge ho to blind `git pull origin main` mat karo — pehle branch/commit confirm karo.
- Full env + contract set steps: **`deploy.md`**

---

## 13. Admin / Multisig ops (short)

- ICO phase complete / start aksar Multisig **submit → 3 confirms** se hota hai.
- Admin ICO Contract screen se setup save / Multisig helper buttons.
- Expense RACE mint/spend Multisig 3-of-5 se — single admin wallet se unlimited mint nahi.

---

## 14. Safety rules for developers / AI

**Do not:**

- Tokenomics / MAX_SUPPLY / ICO cap / expense allocation change
- Fake chain id 56
- Sign auth before real `eth_chainId` 56
- Smart contract tokenomics “silent fix” against locked numbers
- Remove existing wallet support
- Blindly change income % without explicit ask

**Do:**

- Integrate with locked RaceCoin
- Fix wallet UX, indexing, UI, security, tests, deploy docs
- Report conflicts (e.g. old 50M docs vs 150M lock) and wait for instruction

---

## 15. Useful docs in repo

| File | Content |
|------|---------|
| `deploy.md` | Live server deploy + env contracts |
| `contracts/README.md` | Contracts overview (**supply numbers may be outdated**) |
| `contracts/DECENTRALIZED_ARCHITECTURE.md` | On-chain engine target design |
| `docs/` | Audits / fix reports |
| `.cursor/rules/race-tokenomics-locked.mdc` | Immutable tokenomics rule |

---

## 16. Quick FAQ

**Q: Laravel RACE balance final ownership hai?**  
A: Nahi. On-chain RACE final hai; Laravel history/UI/index hai.

**Q: Swap ka custom contract hai?**  
A: Nahi — PancakeSwap V2 use hota hai.

**Q: Trust mein menu BNB dikhe lekin site Ethereum?**  
A: Menu ≠ injected chain. Site `eth_chainId` padhti hai; 56 confirm hone tak login sign nahi.

**Q: Tokenomics change kar sakte hain?**  
A: Nahi — permanently locked (150M / 600k ICO / 30M expense / 3-of-5).

---

## License / ownership

Private project for RACE Network / racenetwork.live operations.  
Default Laravel framework boilerplate license applies only to upstream Laravel framework code, not to RACE business logic or contracts.
