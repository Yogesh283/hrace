# TESTNET DEPLOYMENT MANIFEST

**Network:** BSC Testnet  
**Chain ID:** 97  
**Manifest file:** `contracts/deployments/bscTestnet/deployment.json`  
**Verified at:** 2026-09-23T01:22Z (RPC probe + `check:testnet-deployment` + `verify:engine-testnet` + UAT)  
**Deployer:** `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984`  
**Original deploy completedAt:** 2026-09-13T04:00:45.927Z  
**C-1 Engine redeploy:** 2026-09-14T07:40:42.828Z block 130944412  

**This run:** Full greenfield redeploy **NOT executed** (ecosystem already live; tBNB LOW; `CONFIRM_ENGINE_REDEPLOY` unset). Status = verify + inventory + UAT against live addresses.

**MAINNET READY = NO**

---

## Network print (preflight)

| Field | Value |
|-------|-------|
| NETWORK | bscTestnet |
| CHAIN ID | 97 |
| RPC | data-seed-prebsc-1-s1.binance.org:8545 |
| DEPLOYER | 0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984 |
| BALANCE | ~0.186 tBNB (LOW) |
| CONFIRM_TESTNET_DEPLOYMENT | YES |
| CONFIRM_BSC_TESTNET_DEPLOY | unset (scripts use CONFIRM_TESTNET_DEPLOYMENT) |
| USDT | TestnetMockUSDT 0xE30F…8fEc |
| PANCAKE_ROUTER | 0xD99D1c33F9fC3444f8101754aBC46c52416550D1 |

---

## Contracts

| Contract | Testnet Address | Owner | Status |
|----------|-----------------|-------|--------|
| TestnetMockUSDT | 0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc | mint: deployer | PASS |
| RaceMultiSig | 0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a | threshold=3 / 5 signers | PASS |
| RaceCoin | 0xbCAE5e637872a2760065ff9e9f6533ECC80122e6 | MultiSig | PASS |
| RaceTreasury | 0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A | MultiSig | PASS |
| RaceDevelopmentTreasury | 0xfFfF27aFdADf6F58276d2293A3246eDAd2B4cd5f | MultiSig withdraw | PASS |
| RaceMarketingTreasury | 0x67e5d4ab5187a9292F47e7FeC6a0b067dD64084A | MultiSig withdraw | PASS |
| RaceOperationsTreasury | 0x08Bba9326DbCc9f7f9C615dDb4889656e1C3cCFA | MultiSig withdraw | PASS |
| RaceAutoLiquidity | 0xafC443895FAb63F4221B50Cc9dceB46ce925F146 | — | PASS (code live) |
| RaceRewardVault | 0x44aB7B654dAA8184C7B43CAcB69994969A926ca4 | MultiSig | PASS |
| RaceRewardPriceOracle | 0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a | MultiSig | PASS |
| RaceCommunityEngine | 0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef | MultiSig | PASS live / **BYTECODE≠REPO** |
| RaceICO | 0x9C227938885f5fE4f91826EC6dB37ea54AC31C73 | MultiSig | PASS |
| RaceGovernor | 0xD53De472E9363B5eA08BAF919955B6332575A85D | — | PASS (deployed) |
| RaceEcosystemVault | 0x6bBBe3AB18f2639c2Ade66F68D1F4edf32Bdc6D9 | — | PASS (deployed) |
| Strategic vesting | 0x1AF0856957FB35d6143C204C84c5187aBc01E70E | — | PASS |
| Dev vesting | 0xDBC3C6e5295A2244036DB93E3DfF626d94ab02D9 | — | PASS |
| Partnerships vesting | 0x859929b84D3Ded76fd409289724Ae0a78f75de74 | — | PASS |
| RaceStaking (legacy) | 0xA31C053767034C86BaB132B53686AAb7898255A3 | — | LEGACY |
| RaceRewardPool (legacy) | 0x77116d2B7f00F17fdEA1E2076dBAEfD257E004C8 | — | LEGACY |
| RaceParticipation (legacy) | 0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5 | — | LEGACY |
| RaceLiquidityLocker | — | — | NOT DEPLOYED |
| RaceGovernance | — | — | NOT DEPLOYED |
| RaceIncomeVault | — | — | BLOCKED / NOT DEPLOYED |
| RaceLendingBorrowing | — | — | BLOCKED (incomplete product) |

### ICO adminWallet (USDT destination)

`0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` (= deployer EOA on this testnet)

### RaceCoin supply (on-chain)

| Field | Value |
|-------|-------|
| MAX_SUPPLY | 150_000_000 RACE |
| totalSupply | ~1_000_408 RACE |
| minter ICO | true |
| minter Vault | true |

### Ownership hardening TXs (from prior post-deploy)

See `deployment.json` → `postDeployTxs` (oracle/engine/treasury/raceCoin/ico/vault → MultiSig).

---

## Dependencies snapshot

```
TestnetMockUSDT
RaceCoin.minters → RaceICO, RaceRewardVault
RaceRewardVault.engine → RaceCommunityEngine
RaceICO.stakingEngine → RaceCommunityEngine
RaceICO.usdt → TestnetMockUSDT
RaceICO.adminWallet → 0xB836…E984
RaceCommunityEngine.{rewardVault, oracle, ico, maturityTreasury} → wired + treasury locked
```
