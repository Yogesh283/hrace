# RaceCommunityEngine — Testnet Redeployment Plan (ENG-HIGH-01)

**Scope:** BSC Testnet (chainId 97) only.  
**Status:** Procedure document only — **no transactions executed** by this task.

## Why redeploy

Repository source includes **ENG-HIGH-01**: `distributeReward` requires `msg.sender == user` (`RaceCommunityEngine.sol`). The active testnet engine was deployed **before** this compile; live runtime bytecode **does not match** current repo `deployedBytecode` (see `docs/ENGINE_REDEPLOYMENT_SECURITY_REPORT.md`).

## Phase 1 — Deployment-readiness audit (manifest + scripts)

### 1. Current CommunityEngine deployment script

| Item | Value |
|------|--------|
| **Primary redeploy script** | `contracts/scripts/redeploy-engine-c1-testnet.js` |
| **npm alias** | `npm run redeploy:engine-c1-testnet` (from `contracts/`) |
| **Initial full stack deploy** | `contracts/scripts/deploy.js` (not used for ENG fix alone) |

**Required env (redeploy script gates):**

- `DEPLOY_ENV=testnet`
- `CONFIRM_TESTNET_DEPLOYMENT=YES`
- `CONFIRM_ENGINE_REDEPLOY=YES`
- Valid `DEPLOYER_PRIVATE_KEY` (non-placeholder)
- Five multisig private keys available to script (`detectMultisigPrivateKeys`) for 3-of-5 `vault.setEngine` / `ico.setStakingEngine` / ownership if needed
- Optional resume: `C1_RESUME_NEW_ENGINE=<address>` if deploy succeeded but relink incomplete

**Mainnet:** Script throws if `chainId === 56`.

### 2. Constructor arguments (`RaceCommunityEngine.deploy`)

Order matches `redeploy-engine-c1-testnet.js`:

1. `initialOwner` — deployer EOA (`deployer.address`) at deploy time; later transferred to MultiSig
2. `usdt` — from manifest
3. `raceCoin` — from manifest (RaceCoin **not** redeployed)
4. `pancakeRouter` — from manifest
5. `rewardVault` — from manifest (`RaceRewardVault`; **immutable** in engine)

Immutables on a **new** engine instance cannot change after deploy.

### 3–10. Current testnet addresses (from `contracts/deployments/bscTestnet/deployment.json`)

| # | Item | Address |
|---|------|---------|
| 3 | **Engine owner (on-chain, live)** | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` (RaceMultiSig, 3-of-5) |
| 4 | **RaceCoin** | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| 5 | **RaceRewardVault** | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| 6 | **RaceICO** | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| 7 | **RaceTreasury (maturity)** | `0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A` |
| 8 | **RaceRewardPriceOracle** | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| 9 | **RaceMultiSig** | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| 10 | **Active CommunityEngine** | `0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef` |

**Related (not redeployed by C-1 script):**

- Deprecated engine (C-0): `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9`
- USDT: `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc`
- Pancake router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`
- Deployer (manifest): `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984`

**Linkages (manifest + live verify):**

- `vault.engine()` → active engine `0xbdDe…`
- `ico.stakingEngine()` → active engine `0xbdDe…`
- Engine `rewardPriceOracle()` → oracle above
- Engine `icoContract()` → ICO above
- Engine `maturityTreasury()` → treasury above; `maturityTreasuryLocked()` = true on live engine

### State lost on **new** engine deployment (not migratable on-chain)

The contract has **no** migration / stake import / state transfer functions (confirmed by source search).

A fresh `RaceCommunityEngine` starts empty. The following **do not** move to the new address:

- All `mapping` state: `_members`, `_stakes`, `_leadershipPaid`, `_maturityEmis`, `lastSuccessfulClaimAt`
- `claimEnabled`, `totalStakesCreated`, `totalLockedRace`, RACE/USDT balances held **inside** the old engine contract
- Post-constructor config on old engine remains on old address only (new engine must re-run setter steps from redeploy script)

**Existing stakes remain on old Engine and must not be silently abandoned.** Users with stakes only on `0xc0D9…` or `0xbdDe…` continue to interact with **that** contract address unless a separate off-chain / product decision is made (not implemented in protocol).

---

## Phase 2 — Testnet-only redeployment procedure (DO NOT RUN until approved)

Execute only after governance sign-off, manifest backup, and checklist (`ENGINE_REDEPLOYMENT_CHECKLIST.md`).

### Preconditions

1. `cd contracts && npx hardhat compile` — artifact matches ENG-HIGH-01 source.
2. Run read-only verify: `npm run verify:engine-testnet` — record baseline `OLD_ENGINE` and `NOT_CONFIRMED` fix status.
3. Backup `contracts/deployments/bscTestnet/deployment.json`.
4. Record `stakeCount` on **both** `0xbdDe…` and `0xc0D9…` for wallets known to have stakes (script already probes legacy on redeploy).

### Step sequence (mirrors `redeploy-engine-c1-testnet.js`)

| Step | Action | Actor | Verify |
|------|--------|-------|--------|
| 1 | Deploy new `RaceCommunityEngine` with constructor args above | Deployer EOA | Log `NEW_ENGINE` address |
| 2 | `setIcoContract(manifest.raceICO)` | Deployer (owner) | `icoContract()` matches ICO |
| 3 | `setRewardPriceOracle(manifest.raceRewardPriceOracle)` | Deployer | Oracle address matches |
| 4 | `setMaturityTreasury(manifest.raceTreasury)` | Deployer | Treasury matches |
| 5 | `lockMaturityTreasury()` | Deployer | `maturityTreasuryLocked() == true` |
| 6 | MultiSig → `RaceRewardVault.setEngine(NEW_ENGINE)` | 3-of-5 | `vault.engine() == NEW_ENGINE` |
| 7 | MultiSig → `RaceICO.setStakingEngine(NEW_ENGINE)` | 3-of-5 | `ico.stakingEngine() == NEW_ENGINE` |
| 8 | `transferOwnership(raceMultiSig)` on new engine | Deployer or MultiSig | `owner() == MultiSig` |
| 9 | **Do not** call `setClaimEnabled(true)` unless explicit policy | — | `claimEnabled` stays false until governed |
| 10 | Assert old engine `stakeCount` unchanged | Read-only | Same as pre-deploy snapshot |
| 11 | Update `deployment.json`: `raceCommunityEngine`, deprecate prior active to `raceCommunityEngineDeprecated`, refresh `linkages`, append `postDeployTxs` | Off-chain | Manifest matches chain |

### Explicit non-actions (this plan)

- No RaceCoin redeploy or minter changes beyond existing ICO/vault minter flags
- No oracle ownership / price policy change unless separately approved
- No ICO `adminWallet` or sale config change (script only logs preservation)
- No fund transfers from old engine
- No mainnet deploy (`deploy:mainnet` is blocked in `package.json`)

### Post-deploy verification

1. Re-run `npm run verify:engine-testnet` — expect `matchesCurrentRepoCompile: true` on **new** address (update manifest first or pass address via future script flag).
2. On a fork or controlled testnet stake with `claimEnabled=true`, confirm auth probe `HARDENED` / revert `engine: not user` for third-party `distributeReward`.
3. Run Hardhat `test/security/RaceEngineDistributeRewardFix.test.js`.

---

## References

- Live verify script: `contracts/scripts/verify-engine-bytecode-testnet.js`
- Security report: `docs/ENGINE_REDEPLOYMENT_SECURITY_REPORT.md`
- Checklist: `docs/ENGINE_REDEPLOYMENT_CHECKLIST.md`
- Fix test: `contracts/test/security/RaceEngineDistributeRewardFix.test.js`
