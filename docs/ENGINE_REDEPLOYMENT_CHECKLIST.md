# RaceCommunityEngine — Redeployment Checklist (Testnet)

Use with `docs/ENGINE_REDEPLOYMENT_PLAN.md`. **Do not deploy** until every BEFORE item is recorded and approved.

---

## BEFORE redeployment

| Check | Record here / source |
|-------|----------------------|
| Backup manifest | Copy `contracts/deployments/bscTestnet/deployment.json` → dated backup (e.g. `deployment.json.bak-YYYYMMDD`) |
| Record old active Engine | `0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef` |
| Record deprecated Engine (C-0) | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| Record all active addresses | RaceCoin, Vault, ICO, Treasury, Oracle, MultiSig, USDT, Router — from manifest |
| Record owner | MultiSig `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` on engine, vault, ico, raceCoin (manifest `owners`) |
| Record minters | RaceCoin: ICO + Vault minter flags (`linkages.raceCoinMinterIco`, `raceCoinMinterVault`) — **unchanged by C-1 script** |
| Record existing stake counts | `stakeCount(wallet)` on **both** old active and C-0 for deployer + any known user wallets |
| Record `totalStakesCreated` / `totalLockedRace` on active engine | Live verify output |
| Record `claimEnabled` | Expected **false** on testnet today |
| Record ICO completion / sale state | ICO contract read: active round, totals, `adminWallet` (script logs on redeploy) |
| Run live bytecode verify | `cd contracts && npm run verify:engine-testnet` — save JSON output |
| Compile matches source fix | `npx hardhat compile`; ENG-HIGH-01 line present in `RaceCommunityEngine.sol` |
| Governance keys | 3-of-5 signers available for vault + ICO multisig txs |
| Env confirmations | `CONFIRM_ENGINE_REDEPLOY=YES`, `CONFIRM_TESTNET_DEPLOYMENT=YES`, `DEPLOY_ENV=testnet` |

**Stake / migration reminder:** No on-chain migration. Document which wallets still use C-0 vs active engine.

---

## DURING redeployment (operator ticks)

- [ ] Deploy new engine only via `redeploy-engine-c1-testnet.js` (or resume with `C1_RESUME_NEW_ENGINE`)
- [ ] Constructor immutables match manifest (USDT, RaceCoin, router, vault)
- [ ] `setIcoContract`, `setRewardPriceOracle`, `setMaturityTreasury`, `lockMaturityTreasury` succeeded
- [ ] `vault.setEngine(NEW)` executed via MultiSig (3 confirmations + execute)
- [ ] `ico.setStakingEngine(NEW)` executed via MultiSig
- [ ] `transferOwnership(MultiSig)` on new engine
- [ ] Old engine `stakeCount` unchanged (script assertion)
- [ ] Manifest updated with new `raceCommunityEngine` and deprecated previous active address

---

## AFTER redeployment

| Check | Expected |
|-------|----------|
| New Engine bytecode verified | `verify-engine-bytecode-testnet.js`: `matchesCurrentRepoCompile: true` for **new** address in manifest |
| `owner()` | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` (MultiSig) |
| `vault.engine()` | New engine address |
| `ico.stakingEngine()` | New engine address |
| RaceCoin address | Unchanged `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| Treasury (`maturityTreasury`) | Unchanged `0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A`, locked |
| Oracle | Unchanged `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| Old engine contract | Still deployed; stakes and balances unchanged; **not** deleted |
| `claimEnabled` | Remains **false** until explicit governed enable |
| No unintended ownership changes | RaceCoin, ICO, vault, oracle, treasury still owned by MultiSig |
| No unintended minter changes | Only ICO/vault as before |
| `distributeReward` auth (when claim enabled on fork/test) | Third party reverts `engine: not user`; self-call succeeds |
| Hardhat security tests | `npx hardhat test test/security/RaceEngineDistributeRewardFix.test.js` pass |
| Indexer / Laravel config | Update engine address in env/config if not manifest-driven |
| `MAINNET_DEPLOYMENT` | **NOT ALLOWED** for this procedure |

---

## Rollback note

On-chain rollback of `vault.setEngine` / `ico.setStakingEngine` requires another MultiSig transaction pointing back to the previous engine address. Old engine bytecode and state remain at the old address regardless.
