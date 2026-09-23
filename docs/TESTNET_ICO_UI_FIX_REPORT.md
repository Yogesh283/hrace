# BSC Testnet /ico UI Fix Report

**Date:** 2026-09-13  
**Environment:** BSC Testnet (chain ID **97**)  
**No contracts redeployed. No Solidity / business logic changes. Mainnet not executed.**

---

## Final status

| Check | Result |
|-------|--------|
| COMMUNITY_ENGINE_PROP | **PASS** |
| ONCHAIN_MODE | **PASS** |
| LOCK_DURATION_UI | **PASS** |
| ICO_BUTTON_ENABLE_FLOW | **PASS** |
| MAINNET_EXECUTED | **NO** |

---

## Root cause

Two separate issues caused the screenshot symptoms:

### Problem 1 — “contract ready nahi” vs “Ready to buy”

The browser was serving a **stale production bundle** (`public/build/assets/Isu-CW3z8ANJ.js`), not the updated React source.

That old component expected page props:

- `web3Engine.enabled`
- `web3Engine.engine_contract`
- `lock_tiers[]`

But `IsuController` only passed `web3Ico`. Result:

- `enabled && engine_contract` → **false** → amber warning
- Wallet section still showed **“Ready to buy”** from a separate on-chain member-state read

Laravel backend was already correct (`ico_ready: true`, engine address present). The mismatch was **prop wiring + stale JS bundle**.

### Problem 2 — no lock duration buttons

Same stale bundle: `lock_tiers` defaulted to `[]`, so the UI filtered plans to zero and rendered **no selectable cards**, while still showing the static Flexible-not-allowed text.

---

## Fix path (deployment.json → UI)

| Layer | Change |
|-------|--------|
| `deployment.json` | (unchanged) authoritative Testnet addresses |
| `.env` | `RACE_COMMUNITY_ENGINE_CONTRACT=0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` + ICO/USDT vars |
| `config/blockchain.php` | `community_engine` from `RACE_COMMUNITY_ENGINE_CONTRACT` |
| `BlockchainMode::onChainEnabled()` | Testnet (97): enabled when engine address configured |
| `BlockchainContractPayload::icoPagePayload()` | Sends `on_chain_enabled`, `engine_ready`, `ico_ready`, `community_engine`, `stake_plans` (4 fixed plans) |
| `IsuController` | Passes `web3Ico`, **`web3Engine`**, **`lock_tiers`** (backward compatible) |
| `HandleInertiaRequests` | Shared `blockchain.ico` + `blockchain.web3` |
| `resources/js/Pages/Isu.jsx` | Unified readiness checks; lock cards `[180D][365D][730D][1095D]`; **Selected lock** row; buy button gating |
| `resources/js/app.jsx` | DEV `console.log` sync diagnostics |
| `npm run build` | New bundle `Isu-BNDV4A-f.js` (old Hindi warning bundle removed) |

---

## Verified backend payload

```
chain_id: 97
on_chain_enabled: true
engine_ready: true
ico_ready: true
community_engine: 0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9
ico_contract: 0x9C227938885f5fE4f91826EC6dB37ea54AC31C73
usdt_contract: 0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc
stake_plans: 4 (180 / 365 / 730 / 1095)
```

Command: `php artisan blockchain:verify-testnet`

---

## Frontend verification

Production bundle check (new `Isu-BNDV4A-f.js`):

- Removed: `ready nahi`, `Staking / ICO contract ready nahi`, `Pehle duration select`
- Present: `Lock duration`, `Selected lock`, `180D`…`1095D` cards, `Buy & Stake RACE`

DEV console (browser):

```javascript
console.log('[ico:config]', { chainId, isTestnet, onChainMode, raceCommunityEngine, raceIco, usdt, ... })
console.log('[web3:sync]', { ... })
```

---

## Expected UI at http://localhost:8000/ico

1. No “contract ready nahi” warning when Testnet config is valid  
2. Green config banner: CommunityEngine + ICO + TEST-USDT on chain 97  
3. Lock cards: **[180D] [365D] [730D] [1095D]**  
4. **Selected lock:** updates when a card is clicked (default 180D)  
5. **Buy & Stake RACE** enabled when wallet + amount + phase + lock selected (no auto tx)  
6. Wallet stays on BSC Testnet / chain 97 via `useWalletNetwork`  

---

## Commands executed

```powershell
cd c:\xampp\htdocs\Rynexcapital
Remove-Item Env:BSC_RPC_URL -ErrorAction SilentlyContinue
php artisan optimize:clear
npm install ethers@^6.13.0 --save   # required for Vite build (Governance.jsx import)
npm run build
php artisan blockchain:verify-testnet
```

For local dev:

```powershell
npm run dev
php artisan serve
```

Hard-refresh browser (Ctrl+F5) after build so manifest loads `Isu-BNDV4A-f.js`.

---

## Files changed

- `app/Http/Controllers/IsuController.php`
- `resources/js/Pages/Isu.jsx`
- `resources/js/app.jsx`
- `package.json` / `package-lock.json` (ethers dependency for build)
- `public/build/*` (rebuilt assets)

---

## Safety

- No contract redeploy  
- No ICO/staking/reward formula changes  
- No hardcoded addresses in React — all from Laravel `BlockchainContractPayload` / Inertia props  
- No automatic transactions — UI/validation only  
