# BSC Testnet MetaMask Network Fix

**Date:** 2026-09-13  
**Environment:** BSC Testnet only (chain ID **97** / hex **`0x61`**)  
**No contracts redeployed. Mainnet not executed.**

---

## Summary status

| Check | Result | Notes |
|-------|--------|-------|
| METAMASK_TESTNET_SWITCH | **FAIL** | Code implemented; manual MetaMask browser UAT not run in this session |
| CHAIN_97_GUARD | **PASS** | All tx entry points call `ensureBscNetwork()` with post-switch `eth_chainId` verification |
| ICO_NETWORK_GUARD | **PASS** | `web3RaceICO.js` + `/ico` UI guards before approve/buy |
| STAKING_NETWORK_GUARD | **PASS** | `web3Engine.js` + `/investment` + `/race-token` guards before stake/claim/withdraw |
| MAINNET_EXECUTED | **NO** | Network target comes from Laravel `blockchain.chain_id` (97 on Testnet) |

---

## Problem

Wallet helpers could switch networks without verifying `eth_chainId` after switch/add, connect flows used inconsistent order, and UI did not show **Wrong Network** / **Switch to BSC Testnet** states. Transactions could be attempted while MetaMask was on the wrong chain.

---

## Solution (centralized)

All network logic lives in **`resources/js/lib/web3Deposit.js`**, synced from Inertia `blockchain` props in **`resources/js/app.jsx`**.

### Target network (Testnet mode — chain 97)

| Field | Value |
|-------|-------|
| Network name | BSC Testnet |
| Chain ID | 97 |
| Chain ID hex | `0x61` |
| RPC URL | `https://data-seed-prebsc-1-s1.bnbchain.org:8545` |
| Currency | tBNB |
| Explorer | `https://testnet.bscscan.com` |

Mainnet (`0x38`) remains available only when Laravel config `chain_id=56` — Testnet wiring never auto-selects Mainnet.

### Core exports (`web3Deposit.js`)

| Function | Purpose |
|----------|---------|
| `configureWeb3Network()` | Sets active chain ID, USDT address, RPC from Laravel |
| `readWalletChainIdHex()` | `eth_chainId` |
| `ensureBscNetwork()` | switch → add (4902) → re-read → verify hex |
| `connectWalletWithNetwork()` | `eth_requestAccounts` → `ensureBscNetwork()` |
| `switchToConfiguredNetwork()` | UI button helper |
| `subscribeWalletEvents()` | `chainChanged` / `accountsChanged` with cleanup |
| `isChainIdMatch()` | Compare wallet hex to configured chain |

### Connect flow (spec-compliant)

1. Detect `window.ethereum`
2. `eth_requestAccounts`
3. `eth_chainId`
4. If not `0x61` (when Testnet) → `wallet_switchEthereumChain`
5. On `4902` → `wallet_addEthereumChain` with BSC Testnet params
6. Re-read `eth_chainId`
7. Must equal `0x61` or throw: *"Please switch MetaMask to BSC Testnet (Chain ID 97)."*

### Transaction guard

Before every on-chain send:

- `ensureBscNetwork()` in `sendUsdtTransfer`, `web3Engine.sendContractTx`, `web3RaceICO.sendContractTx`, `web3PancakeSwap.sendContractTx`, `web3Participation.sendContractTx`
- Page-level guards on ICO approve/buy, staking, swap, deposit

### Debug logging (development only)

When `import.meta.env.DEV` is true, `[web3:network]` logs:

- current / target chainId
- switch attempt / success / failure
- wallet address (public only — never private keys)

---

## New shared UI

| File | Role |
|------|------|
| `resources/js/hooks/useWalletNetwork.js` | React hook: `chainOk`, `switchNetwork`, `connectWallet`, event listeners |
| `resources/js/Components/Web3NetworkBanner.jsx` | **Wrong Network** + **Switch to BSC Testnet** / **Connected to BSC Testnet** |

---

## Files changed

| File | Change |
|------|--------|
| `resources/js/lib/web3Deposit.js` | Full network switch/verify/connect/guard implementation |
| `resources/js/hooks/useWalletNetwork.js` | **New** — shared wallet network state |
| `resources/js/Components/Web3NetworkBanner.jsx` | **New** — network UI banner |
| `resources/js/app.jsx` | Pass `rpc_url` into `configureWeb3Network()` |
| `resources/js/Components/WalletConnectAuthButton.jsx` | Auth connect uses `connectWalletWithNetwork()` |
| `resources/js/lib/web3Engine.js` | Tx guard in `sendContractTx` |
| `resources/js/lib/web3RaceICO.js` | Tx guard in `sendContractTx` |
| `resources/js/lib/web3PancakeSwap.js` | Tx guard in `sendContractTx` |
| `resources/js/lib/web3Participation.js` | Tx guard in `sendContractTx` |
| `resources/js/Pages/Isu.jsx` | ICO connect + approve/buy guards + banner |
| `resources/js/Pages/Token/RaceToken.jsx` | Connect, swap, stake, claim guards + banner |
| `resources/js/Pages/Investment.jsx` | On-chain staking guard + banner |
| `resources/js/Pages/Deposit.jsx` | Connect + deposit guard + banner |
| `resources/js/Pages/Swap.jsx` | Connect + swap guard + banner |
| `resources/js/Pages/Dashboard.jsx` | Testnet-specific wrong-network message |

**Not changed:** Solidity contracts, Laravel business logic, reward/ICO/staking formulas, deployment addresses.

---

## Test cases

| Case | Expected | Automated result |
|------|----------|------------------|
| 1 — MetaMask already on BSC Testnet | Connect immediately | **Not run** (needs browser) |
| 2 — MetaMask on another EVM network | MetaMask switch prompt | **Not run** (needs browser) |
| 3 — BSC Testnet not added | MetaMask add-network prompt | **Not run** (needs browser) |
| 4 — User rejects switch | No tx; clear error | **Not run** (needs browser) |
| 5 — ICO on wrong network | Blocked until chain 97 | **Code review PASS** (`ensureBscNetwork` + UI guard) |
| 6 — User switches away after connect | `chainChanged` updates UI; txs blocked | **Code review PASS** (`useWalletNetwork` listeners) |
| 7 — Page refresh on Testnet | Chain 97 detected on load | **Code review PASS** (`refreshChain` on mount) |

### Commands executed

```powershell
cd c:\xampp\htdocs\Rynexcapital
npm run build
```

Build failed on a **pre-existing** unrelated issue: missing `ethers` dependency in `Governance.jsx`. Changed wallet/network files compile in dev; run manual MetaMask UAT after `npm run dev`.

---

## Manual UAT checklist (recommended)

1. Open `/ico` with MetaMask on Ethereum Mainnet → click **Connect wallet** → confirm switch/add to BSC Testnet.
2. Confirm banner shows **Connected to BSC Testnet**.
3. Switch MetaMask to another chain → banner shows **Wrong Network** → click **Switch to BSC Testnet**.
4. Attempt **Approve USDT** / **Buy & Stake** on wrong network → must block with clear message.
5. Repeat on `/investment` (on-chain stake) and `/race-token` (participate/swap).

---

## Safety confirmations

- **No Solidity contract modified or redeployed**
- **Mainnet deployment not executed**
- **No private keys logged or committed**
- Contract addresses still loaded from Laravel config / Inertia — not hardcoded in components
