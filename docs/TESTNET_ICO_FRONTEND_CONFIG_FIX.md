# BSC Testnet ICO Frontend Configuration Fix

**Date:** 2026-09-13  
**Environment:** BSC Testnet (chain **97**) only  
**No contracts redeployed. Mainnet not executed.**

---

## Root cause

Backend `.env` already had correct Testnet addresses, but the `/ico` React page could still show “contract not ready” because:

1. **`icoPagePayload()` did not expose `on_chain_enabled`, `engine_ready`, or `ico_ready`** — the UI could not distinguish “ICO addresses set” vs “CommunityEngine + on-chain mode ready”.
2. **`contracts_deployed` ignored CommunityEngine** — mint-to-stake ICO requires Engine linkage; UI treated config as incomplete or showed misleading engine warnings.
3. **Frontend read only the page prop `web3Ico`** — if stale/empty, it did not fall back to shared Inertia `blockchain.ico` (same source, always present on navigation).
4. **On-chain mode was env-global** — now **Testnet auto-enables** when `RACE_COMMUNITY_ENGINE_CONTRACT` is set; **Mainnet still requires explicit flags**.

---

## Configuration path (verified)

```
contracts/deployments/bscTestnet/deployment.json
  raceCommunityEngine → 0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9
        ↓
.env  RACE_COMMUNITY_ENGINE_CONTRACT=0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9
        ↓
config/blockchain.php  contracts.community_engine
  (aliases: RACE_COMMUNITY_ENGINE_ADDRESS, RACE_COMMUNITY_ENGINE)
        ↓
BlockchainContractPayload::icoPagePayload()
        ↓
IsuController → Inertia prop web3Ico
HandleInertiaRequests → shared blockchain.ico
        ↓
resources/js/Pages/Isu.jsx  (merges blockchain.ico + web3Ico)
resources/js/app.jsx        (configureWeb3Network + dev logs)
```

---

## Files changed

| File | Change |
|------|--------|
| `config/blockchain.php` | Env alias compatibility for CommunityEngine |
| `app/Support/BlockchainMode.php` | `onChainEnabled()` — Testnet-only auto enable |
| `app/Services/Blockchain/BlockchainContractPayload.php` | ICO payload: `on_chain_enabled`, `engine_ready`, `ico_ready`, `contracts`, debug |
| `app/Console/Commands/VerifyBlockchainTestnetCommand.php` | ICO payload + bytecode + stake plan checks |
| `resources/js/Pages/Isu.jsx` | Merge `blockchain.ico`, ready flags, dev diagnostics |
| `resources/js/app.jsx` | Dev diagnostic log on Inertia sync |

---

## Env variables (canonical)

| Variable | Testnet value |
|----------|---------------|
| `BSC_CHAIN_ID` | `97` |
| `RACE_COMMUNITY_ENGINE_CONTRACT` | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| `RACE_ICO_CONTRACT` | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| `RACE_TOKEN_CONTRACT` | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| `USDT_CONTRACT_BEP20` | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |

Aliases also accepted: `RACE_COMMUNITY_ENGINE_ADDRESS`, `RACE_COMMUNITY_ENGINE`.

---

## On-chain mode (Testnet only)

```php
// chain_id === 97 → on-chain enabled when CommunityEngine address is configured
// chain_id === 56 → unchanged; requires REWARDS_ENGINE=blockchain_only OR PARTICIPATION_ON_CHAIN=true
```

---

## Verification commands

```powershell
cd c:\xampp\htdocs\Rynexcapital
php artisan optimize:clear
php artisan blockchain:verify-testnet
```

**Result (2026-09-13):**

```
ICO payload on_chain_enabled: true
ICO payload engine_ready: true
ICO payload ico_ready: true
ICO community_engine: 0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9
PASS: bytecode community_engine ...
ICO stake_plans: 4
LARAVEL_TESTNET_WIRING probe: PASS
```

---

## Frontend dev diagnostics

With `APP_DEBUG=true` and Vite dev mode, browser console shows:

- `[web3:sync]` on page load (from `app.jsx`)
- `[ico:config]` on `/ico` (from `Isu.jsx`)

Logged fields: `chainId`, `network`, `raceIco`, `raceCommunityEngine`, `usdt`, `onChainEnabled`, `engineReady`, `contractsReady`.

---

## Lock duration (ICO)

Stake plans from backend (no Flexible):

| Plan | Days |
|------|------|
| 180 Days | 180 |
| 365 Days | 365 |
| 730 Days | 730 |
| 1095 Days | 1095 |

---

## Manual browser UAT (required)

1. Restart Laravel + `npm run dev`
2. Hard refresh `/ico`
3. Confirm green banner: CommunityEngine configured for chain 97
4. Select **180 Days**, enter **1** USDT (if validation allows)
5. **Buy & Stake** enabled when wallet connected, chain 97, active phase, allowance OK
6. Do **not** auto-submit — manual MetaMask confirm only

---

## Final status

| Check | Result |
|-------|--------|
| COMMUNITY_ENGINE_CONFIG | **PASS** (Laravel + bytecode verified) |
| ONCHAIN_MODE_TESTNET | **PASS** (`on_chain_enabled: true` on chain 97) |
| ICO_CONTRACT_CONFIG | **PASS** |
| USDT_CONFIG | **PASS** (TestnetMockUSDT) |
| LOCK_OPTIONS | **PASS** (4 fixed plans in payload) |
| ICO_UI_READY | **FAIL** (manual browser UAT not run in this session) |
| MAINNET_EXECUTED | **NO** |
