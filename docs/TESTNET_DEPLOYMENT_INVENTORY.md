# TESTNET DEPLOYMENT INVENTORY

**Network:** BSC Testnet (chainId **97**) only  
**Scanned:** 2026-09-23  
**Source of live addresses:** `contracts/deployments/bscTestnet/deployment.json`  
**Safety gate used:** `DEPLOY_ENV=testnet` + `CONFIRM_TESTNET_DEPLOYMENT=YES` (project flag; alias `CONFIRM_BSC_TESTNET_DEPLOY` not required by scripts)

---

## Classification

| Contract | Class | Active/Legacy | Purpose | Dependencies | Deploy order | Required env | Owner (testnet) | Testnet address |
|----------|-------|---------------|---------|--------------|--------------|--------------|-----------------|-----------------|
| TestnetMockUSDT | TEST MOCKS | Active (test assets) | Fake USDT 18dp | — | 1 | `TESTNET_USDT_ADDRESS` | Deployer mint | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| RaceMultiSig | TREASURY / MULTISIG | Active | 3-of-5 control | 5 signers | 2 | `MULTISIG_SIGNER_1..5` | N/A (immutable signers) | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| RaceCoin | TOKEN / REWARD | Active | RACE BEP20, MAX 150M, 4% fee | fee recipients | 3 | — | MultiSig | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| RaceTreasury | TREASURY / MULTISIG | Active | Reserve withdraw via MS | MultiSig, RaceCoin | 4 | — | MultiSig | `0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A` |
| RaceDevelopmentTreasury | TREASURY / MULTISIG | Active | Expense fund | MultiSig | 4b | — | MultiSig-only withdraw | `0xfFfF27aFdADf6F58276d2293A3246eDAd2B4cd5f` |
| RaceMarketingTreasury | TREASURY / MULTISIG | Active | Expense fund | MultiSig | 4c | — | MultiSig-only | `0x67e5d4ab5187a9292F47e7FeC6a0b067dD64084A` |
| RaceOperationsTreasury | TREASURY / MULTISIG | Active | Expense fund | MultiSig | 4d | — | MultiSig-only | `0x08Bba9326DbCc9f7f9C615dDb4889656e1C3cCFA` |
| RaceAutoLiquidity | LIQUIDITY | Active | 1% fee → LP | Race, USDT, Router | 5 | `PANCAKE_ROUTER_ADDRESS` | Deployer/ops | `0xafC443895FAb63F4221B50Cc9dceB46ce925F146` |
| RaceRewardPool | LEGACY / DEPRECATED | Legacy | Old emission pool | RaceCoin | — | — | MultiSig path | `0x77116d2B7f00F17fdEA1E2076dBAEfD257E004C8` |
| RaceStaking | LEGACY / DEPRECATED | Legacy | Old stake model | RewardPool | — | — | — | `0xA31C053767034C86BaB132B53686AAb7898255A3` |
| RaceRewardVault | TOKEN / REWARD | Active | Engine payout vault | RaceCoin, Engine | 6 | — | MultiSig | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| RaceRewardPriceOracle | ORACLE | Active | Claim/maturity price | updater | 7 | `RACE_REWARD_PRICE_USDT` | MultiSig | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| RaceCommunityEngine | CORE ACTIVE | Active | Participate, claim, referral, leadership, exit | USDT, Race, Router, Vault | 8 | — | MultiSig | `0xbdDeA78d9Ef21BF7E8577de8BFe599E5dd0456ef` |
| RaceCommunityEngine (deprecated) | LEGACY | Deprecated | Pre–C1 engine | — | — | — | — | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| RaceParticipation | LEGACY / DEPRECATED | Legacy standalone | Older participate | — | — | — | — | `0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5` |
| RaceICO | ICO | Active | USDT→adminWallet, mint→Engine stake | RaceCoin, USDT, Engine | 9 | `ICO_ADMIN_WALLET` (optional) | MultiSig | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| RaceGovernor | GOVERNANCE | Supporting | Stake-weighted DAO | staking | 10 | optional | — | `0xD53De472E9363B5eA08BAF919955B6332575A85D` |
| RaceEcosystemVault | TREASURY | Supporting | Ecosystem releases | governance | 11 | — | — | `0x6bBBe3AB18f2639c2Ade66F68D1F4edf32Bdc6D9` |
| RaceVesting (×3) | VESTING | Supporting | Strategic / Dev / Partners | RaceCoin | 12 | — | Multisig beneficiary | see manifest |
| RaceLiquidityLocker | LIQUIDITY | **Not deployed** | LP lock 5y | LP token | — | LP after pair | — | — |
| RaceGovernance | GOVERNANCE | **Not deployed** | 10–12 member council | members | — | `GOVERNANCE_MEMBER_*` | self | — |
| RaceIncomeVault | INCOME VAULT | **Not deployed** | Signed USDT income settle | USDT, signer, fee recipient | — | `CONFIRM_INCOME_VAULT_DEPLOY=YES` | — | — |
| RaceLendingBorrowing | LENDING | **BLOCKED** | USDT lending only; **no RACE stake allocation** | ICO completion | — | — | — | — |
| Mock* / LendingReentrancyAttacker | TEST MOCKS | Tests only | Hardhat | — | — | — | — | — |

---

## Do NOT deploy as active production paths

- `RaceStaking` + `RaceRewardPool` (legacy emission)
- Deprecated Engine `0xc0D9…F4E9`
- `RaceParticipation` (logic in Engine)
- `RaceLendingBorrowing` until it actually stakes RACE (business incomplete)

---

## Wiring (verified on-chain 2026-09-23)

| Link | Expected | Live |
|------|----------|------|
| Vault.engine | CommunityEngine | `0xbdDe…456ef` ✓ |
| ICO.stakingEngine | CommunityEngine | same ✓ |
| Engine.rewardVault | RewardVault | ✓ |
| Engine.rewardPriceOracle | Oracle | ✓ |
| Engine.icoContract | RaceICO | ✓ |
| Engine.maturityTreasury | RaceTreasury (locked) | ✓ |
| RaceCoin minters | ICO + Vault | both true ✓ |
| ICO.adminWallet | ICO USDT destination | `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` |
| ICO.usdt | TestnetMockUSDT | ✓ |

---

## Engine source sync warning

`verify:engine-testnet` → `bytecode.matchesCurrentRepoCompile: **false**`  
Live Engine ≠ current repo (includes later referral gate change).  

**Fresh Engine redeploy requires:** `CONFIRM_ENGINE_REDEPLOY=YES` + Multisig 3-of-5 keys + sufficient tBNB (deployer ~0.186 tBNB = LOW).

---

## Laravel env (root `.env`, chain 97)

Already points at this testnet set (`RACE_*_CONTRACT`, `USDT_CONTRACT_BEP20`, `BSC_CHAIN_ID=97`).
