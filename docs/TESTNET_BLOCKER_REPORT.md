# TESTNET BLOCKER REPORT

**Date:** 2026-09-13  
**Network:** BSC Testnet only (chain ID **97**)  
**RaceMultiSig.sol:** UNCHANGED  
**Live deployment:** NOT EXECUTED  
**Rule:** Addresses below are taken only from current repo docs + live chain probe of an address already present in `contracts/.env.example`. No Mainnet addresses. No invented “official USDT”.

---

## 1. PancakeSwap integration (from current Solidity)

| Question | Finding |
|----------|---------|
| Version | **PancakeSwap V2** (Router02 API) |
| V3 | **Not used** |
| Universal Router | **Not used** |
| Custom router | Only **test double** `MockPancakeRouter` in Hardhat tests |

**Evidence (interface + call sites):**

- `contracts/src/interfaces/IPancakeRouter.sol` — `IPancakeRouter02` with:
  - `factory()`
  - `WETH()`
  - `getAmountsOut`
  - `addLiquidity`
  - `swapExactTokensForTokensSupportingFeeOnTransferTokens`
- Used by:
  - `RaceCommunityEngine` — constructor `pancakeRouter_`; `_swapUsdtToRace`; `PancakePrice.usdtToRace`
  - `RaceParticipation` — same V2 swap/quote path
  - `RaceAutoLiquidity` — V2 swap + `addLiquidity`
  - `libraries/PancakePrice.sol` — `getAmountsOut` only

**Reward mint price** uses `RaceRewardPriceOracle` (pushed price), **not** Pancake spot — but Engine/Participation/AutoLiq still need a V2-compatible router address at **construction**.

---

## 2. Exact Testnet router address

### What Solidity requires

Solidity does **not** hardcode a Testnet router. Constructors take `address pancakeRouter_` / `router_` and cast to `IPancakeRouter02`.

### What this repo documents

| Source | Value |
|--------|--------|
| `contracts/.env.example` | `PANCAKE_ROUTER_ADDRESS=0xD99D1c33F9fC3444f8101754aBC46c52416550D1` |
| `contracts/README.md` | Documents **Mainnet** router only (`0x10ED43…`) — **refused** by current Testnet deploy guards |
| Solidity | No Testnet router constant |

### Live probe (chain 97, this session)

Address from `.env.example`: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`

| Check | Result |
|-------|--------|
| `chainId` | 97 |
| `getCode` | non-empty (has bytecode) |
| `factory()` | `0x6725F303b657a9451d8BA641348b6761A6CC7a17` |
| `WETH()` | `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd` |

**Conclusion for THIS architecture:**

- Required type: **Pancake V2 Router02-compatible** contract on chain 97.
- Project-documented Testnet candidate (already in `.env.example`, probed OK):  
  **`0xD99D1c33F9fC3444f8101754aBC46c52416550D1`**
- Env names: `PANCAKE_ROUTER` **or** `PANCAKE_ROUTER_ADDRESS`
- Mainnet router `0x10ED43C718714eb63d5aA57B78B54704E256024E` is **explicitly refused** by `deploy.js` / preflight on Testnet (even if bytecode exists at that address on 97).

This report does **not** claim Pancake Labs “official forever” status; it claims: repo example + on-chain V2 surface match for chain 97.

---

## 3. TESTNET USDT configuration

### What Solidity requires

| Contract | Requirement |
|----------|-------------|
| `RaceICO` | Any ERC20; reads `decimals()`; requires RACE decimals == 18; prices/caps scaled by USDT decimals |
| `RaceCommunityEngine` / `RaceParticipation` | IERC20 USDT for `transferFrom` + swap path `[usdt, race]` |
| `RaceMultisigFund` / Dev/Mkt/Ops treasuries | Allowed tokens = RACE + USDT addresses from constructor |
| Comments / tests | Assume **18-decimal** USDT (BSC-style); tests use `MockERC20('USDT','USDT',18)` |

### What this repo does **not** contain

- **No** hardcoded Testnet USDT address in Solidity.
- **No** hardcoded “official” Testnet USDT in `deploy.js`.
- Mainnet USDT `0x55d398326f99059ff775485246999027b3197955` is **refused** on Testnet.

### Allowed Testnet approaches (operator must supply address)

1. **Deploy project mock** `contracts/src/mocks/MockERC20.sol` on chain 97 with clear TEST-ONLY name/symbol (e.g. name not impersonating Tether), 18 decimals, then set `USDT` / `TESTNET_USDT_ADDRESS` to that address.  
2. Or use a **pre-existing** chain-97 ERC20 that the operator has verified (decimals known) — **not invented by this report**.

Env names: `USDT` **or** `TESTNET_USDT_ADDRESS` **or** `TESTNET_USDT`

---

## 4. `deploy.js` — required vs optional (Testnet)

### Required for Testnet deploy (guards + constructors)

| Variable (canonical / aliases) | Why / where |
|--------------------------------|-------------|
| `DEPLOY_ENV=testnet` | `deploy.js` + `preflight-testnet.js` |
| `CONFIRM_TESTNET_DEPLOYMENT=YES` | `deploy.js` + preflight |
| `DEPLOYER_PRIVATE_KEY` | Hardhat `bscTestnet` accounts; never logged |
| `BSC_TESTNET_RPC` / `BSC_TESTNET_RPC_URL` | Optional override; default public seed RPC; must not be Mainnet |
| `MULTISIG_SIGNERS` **or** `MULTISIG_SIGNER_1..5` | Exactly 5 unique; `RaceMultiSig` constructor |
| `USDT` / `TESTNET_USDT_ADDRESS` / `TESTNET_USDT` | **Constructor arg** for Engine, Participation, ICO, AutoLiq, Dev/Mkt/Ops funds |
| `PANCAKE_ROUTER` / `PANCAKE_ROUTER_ADDRESS` | **Constructor arg** for Engine, Participation, AutoLiq |
| Deployer **tBNB > 0** | Gas; preflight STOP if zero |

`MULTISIG_THRESHOLD` if set must be **3** (immutable model).

### Used at deploy time (not only post-deploy)

USDT and Pancake router are **required for deployment**, not merely post-features:

- `RaceAutoLiquidity.deploy(..., usdt, pancakeRouter)`
- `RaceCommunityEngine.deploy(..., usdt, race, pancakeRouter, vault)`
- `RaceParticipation.deploy(..., usdt, race, pancakeRouter)`
- `RaceICO.deploy(..., race, usdt, adminWallet)`
- `RaceDevelopmentTreasury` / `Marketing` / `Operations` `(multisig, race, usdt)`

Post-deploy features that **also** need a live RACE/USDT V2 pair + liquidity:

- `participate()` USDT→RACE swap
- AutoLiquidity processing
- PancakePrice quotes (MLM USD→RACE path)

ICO `purchase()` itself mints via RaceCoin minter and does **not** call the router, but USDT token address is still required in the ICO constructor.

### Optional / recommended

| Variable | Notes |
|----------|--------|
| `EXPECTED_CHAIN_ID=97` | Guard if set |
| `HARDEN_GOVERNANCE=1` | Transfer ownership → MultiSig after deploy |
| `RACE_REWARD_PRICE_USDT` | Recommended on Testnet (else warn + `$1` placeholder) |
| `RACE_REWARD_PRICE_MIN` / `MAX` | Oracle bounds |
| `ORACLE_UPDATER` | Else defaults toward MultiSig when hardening |
| `ICO_ADMIN_WALLET` | Defaults to deployer |
| `TREASURY` / `DEV_FUND` | Fee wallets if used |
| `LP_TOKEN` | Only if deploying `RaceLiquidityLocker` in same run |
| `GOVERNANCE_MEMBER_*` / `GOVERNANCE_MEMBERS` | Required for **governance** deploy script, optional for core `deploy.js` |
| `GOVERNANCE_THRESHOLD` | Default 7 for governance script |
| `REQUIRE_MULTISIG_SIGNERS` | Force env signers off-testnet |

---

## 5. Current blockers (operator `.env` / funding)

Observed from last preflight (not re-deployed):

| # | Blocker | Why required | Source | Network | Env / action | Configure now? |
|---|---------|--------------|--------|----------|--------------|----------------|
| 1 | `DEPLOY_ENV` unset | Testnet gate | `deploy.js` / `assertTestnetEnvFlags` | 97 | `DEPLOY_ENV=testnet` | **Yes** — set in `contracts/.env` |
| 2 | `CONFIRM_TESTNET_DEPLOYMENT` unset | Explicit confirm | `deploy.js` / preflight | 97 | `CONFIRM_TESTNET_DEPLOYMENT=YES` | **Yes** |
| 3 | Deployer tBNB = 0 | Gas | `check-testnet-balance` / deploy balance check | 97 | Faucet tBNB to deployer | **Yes** — manual faucet |
| 4 | Multisig signers missing | `RaceMultiSig` needs 5 unique | `getMultisigSigners` / preflight | 97 | `MULTISIG_SIGNER_1..5` or `MULTISIG_SIGNERS` | **Yes** — operator wallets |
| 5 | USDT unset | Constructors need ERC20 address; Mainnet USDT refused | `deploy.js` + Engine/ICO/funds | 97 | `TESTNET_USDT_ADDRESS` / `USDT` = operator mock or verified test token | **Yes** — after mock deploy or known token; **do not** use Mainnet USDT |
| 6 | Pancake router unset | Constructors need V2 router | `deploy.js` + Engine/Participation/AutoLiq | 97 | `PANCAKE_ROUTER_ADDRESS=0xD99D1c33F9fC3444f8101754aBC46c52416550D1` (repo example, probed) | **Yes** — if operator accepts this documented candidate |
| 7 | No `deployment.json` | Deploy not run | `check-testnet-deployment.js` | 97 | Run deploy only after preflight PASS | **N/A** until deploy |

Governance members are **optional** for core deploy; required later for `deploy:governance:testnet`.

---

## 6. Safety notes

- Do **not** put Mainnet private keys, Mainnet USDT, or Mainnet router into Testnet `.env`.
- Do **not** treat a Testnet mock USDT as real Tether.
- Clearing blockers ≠ audited / production ready.
- This document does **not** execute deployment.

---

## Final status

```
TESTNET BLOCKERS:
1. DEPLOY_ENV=testnet missing in contracts/.env
2. CONFIRM_TESTNET_DEPLOYMENT=YES missing in contracts/.env
3. Deployer tBNB balance is 0 (needs faucet)
4. Five unique MULTISIG_SIGNER addresses missing
5. TESTNET USDT address missing (no official address in repo — use MockERC20 on 97 or operator-verified test ERC20; never Mainnet USDT)
6. PANCAKE_ROUTER unset (architecture = Pancake V2 Router02; repo-documented Testnet candidate 0xD99D1c33F9fC3444f8101754aBC46c52416550D1 probed on chain 97)

DEPLOYMENT:
NOT EXECUTED
```
