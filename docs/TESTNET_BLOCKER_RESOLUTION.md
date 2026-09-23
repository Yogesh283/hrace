# Testnet Blocker Resolution

**Date:** 2026-09-13  
**Network:** BSC Testnet (chain ID **97**)  
**RaceMultiSig.sol:** UNCHANGED  
**Core Testnet Deployment:** NOT EXECUTED  
**Mainnet:** NOT EXECUTED  

---

## Pancake V2 router

| Field | Value |
|-------|--------|
| Address | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` |
| Chain ID | 97 |
| Factory | `0x6725F303b657a9451d8BA641348b6761A6CC7a17` |
| WETH | `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd` |
| Code present | YES |
| Factory/WETH code | YES |
| V2 compatible (`IPancakeRouter02`) | YES |
| Mainnet router used | NO |
| Env configured | `PANCAKE_ROUTER` (+ `PANCAKE_ROUTER_ADDRESS`) |
| Verification | **PASS** (`npm run check:testnet-pancake`) |

---

## Testnet USDT (TEST ONLY — NOT real USDT)

| Field | Value |
|-------|--------|
| Contract | `TestnetMockUSDT` |
| Address | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| Chain ID | 97 |
| Name | RACE Test USDT |
| Symbol | TEST-USDT |
| Decimals | 18 |
| Mint authority | `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` (deployer / faucet admin) |
| Artifact | `contracts/deployments/bscTestnet/test-usdt.json` |
| Env configured | `USDT` (+ `TESTNET_USDT_ADDRESS`) |
| Hardhat tests | 6 passing |
| Verification | **PASS** |

---

## Commands added

- `npm run check:testnet-pancake`
- `npm run deploy:testnet-usdt`

---

## Preflight

Live run (2026-09-13):

| Check | Result |
|-------|--------|
| `check:testnet-pancake` | PASS |
| `check:testnet-balance` | PASS (~0.30 tBNB) |
| `check:testnet-wallets` | PASS (Multisig addresses present; signers NO_GAS OK) |
| `preflight:testnet` | **PASS** |

**Preflight:** PASS  

**Core Testnet Deployment:** NOT EXECUTED  

**Mainnet:** NOT EXECUTED  

Operator may now run `npm run deploy:testnet` when ready (not executed by this task).

---

## Notes

- `TEST-USDT` is a project mock for Testnet only. It is **not** Tether / official USDT.
- Do not configure this address on Mainnet.
- Core `npm run deploy:testnet` remains blocked until operator explicitly runs it after preflight PASS.
