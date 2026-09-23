# Laravel BSC Testnet Wiring Report

**Date:** 2026-09-13  
**Environment:** BSC Testnet only (chain ID **97**)  
**Authoritative manifest:** `contracts/deployments/bscTestnet/deployment.json`  
**No contracts redeployed. Mainnet not executed.**

---

## Summary status

| Check | Result |
|-------|--------|
| LARAVEL_TESTNET_WIRING | **PASS** |
| INDEXER_TESTNET_CONNECTION | **PASS** |
| FRONTEND_TESTNET_CONFIG | **PASS** |
| CLIENT_UAT_READY | **FAIL** (config ready; manual browser UAT not run) |
| MAINNET_EXECUTED | **NO** |

---

## Chain & RPC

| Setting | Value |
|---------|-------|
| `BSC_NETWORK` | `bsc_testnet` |
| `BSC_CHAIN_ID` | `97` |
| `BSC_RPC_URL` | `https://data-seed-prebsc-1-s1.binance.org:8545` |
| Live RPC `eth_chainId` | `97` (verified) |
| Config source | `config/blockchain.php` → `.env` |

---

## Deployed contract addresses (from deployment.json)

| Contract | Address |
|----------|---------|
| RaceMultiSig | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| RaceCoin | `0xbCAE5e637872a2760065ff9e9f6533ECC80122e6` |
| RaceTreasury | `0x04F3C02018Da34D3641f47C1F136FFcDb57Dc93A` |
| RaceDevelopmentTreasury | `0xfFfF27aFdADf6F58276d2293A3246eDAd2B4cd5f` |
| RaceMarketingTreasury | `0x67e5d4ab5187a9292F47e7FeC6a0b067dD64084A` |
| RaceOperationsTreasury | `0x08Bba9326DbCc9f7f9C615dDb4889656e1C3cCFA` |
| RaceAutoLiquidity | `0xafC443895FAb63F4221B50Cc9dceB46ce925F146` |
| RaceStaking | `0xA31C053767034C86BaB132B53686AAb7898255A3` |
| RaceRewardVault | `0x44aB7B654dAA8184C7B43CAcB69994969A926ca4` |
| RaceCommunityEngine | `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` |
| RaceParticipation | `0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5` |
| RaceICO | `0x9C227938885f5fE4f91826EC6dB37ea54AC31C73` |
| RaceRewardPriceOracle | `0xB5A67CD0D32Ed0D5021827b1C5d6bfd1C401556a` |
| RaceRewardPool | `0x77116d2B7f00F17fdEA1E2076dBAEfD257E004C8` |
| RaceGovernor (legacy) | `0xD53De472E9363B5eA08BAF919955B6332575A85D` |
| RaceEcosystemVault | `0x6bBBe3AB18f2639c2Ade66F68D1F4edf32Bdc6D9` |
| TestnetMockUSDT | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| Pancake V2 router | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` |
| RaceLiquidityLocker | *(not deployed — null in manifest)* |
| RaceGovernance (community) | *(not deployed)* |

Deploy block: **130723087**

---

## Laravel `.env` variables added/updated

Root `.env` had Testnet variables concatenated into a single line (literal `\n`). They were split into proper entries:

- `BSC_NETWORK`, `BSC_CHAIN_ID`, `BSC_RPC_URL`
- `USDT_CONTRACT_BEP20` → TestnetMockUSDT (not mainnet USDT)
- `PANCAKE_ROUTER` → Testnet Pancake V2
- `RACE_TOKEN_CONTRACT`, `RACE_MULTISIG_CONTRACT`, `RACE_TREASURY_CONTRACT`
- `RACE_DEVELOPMENT_TREASURY_CONTRACT`, `RACE_MARKETING_TREASURY_CONTRACT`, `RACE_OPERATIONS_TREASURY_CONTRACT`
- `RACE_REWARD_VAULT_CONTRACT`, `RACE_REWARD_PRICE_ORACLE_CONTRACT`
- `RACE_COMMUNITY_ENGINE_CONTRACT`, `RACE_PARTICIPATION_CONTRACT`, `RACE_ICO_CONTRACT`
- `RACE_STAKING_CONTRACT`, `RACE_REWARD_POOL_CONTRACT`, `RACE_AUTO_LIQUIDITY_CONTRACT`
- `RACE_GOVERNOR_CONTRACT`
- `BLOCKCHAIN_INDEXER_ENABLED=true`
- `BLOCKCHAIN_INDEXER_START_BLOCK=130723087`

No private keys were added to `.env` or source control.

---

## Laravel config

Existing centralized config retained: `config/blockchain.php`

Application code reads addresses via `config('blockchain.contracts.*')`, not hardcoded in controllers.

Additional wiring fix:

- `app/Models/SiteSetting.php` — `depositAddressPayload()` now uses `config('blockchain.chain_id')` and `config('blockchain.contracts.usdt')` instead of hardcoded mainnet chain ID 56.

---

## Verification command

Extended existing command: `php artisan blockchain:verify-testnet`

Checks performed:

1. `config('blockchain.chain_id') == 97` — **PASS**
2. RPC reachable, live chain ID 97 — **PASS**
3. Bytecode at RaceCoin, CommunityEngine, ICO, RewardVault, RewardPriceOracle, MultiSig, TestnetMockUSDT — **PASS**
4. Mainnet USDT/router not selected — **PASS**
5. Laravel config resolves deployment addresses — **PASS**

---

## Indexer audit

**Command:** `php artisan blockchain:index-events`  
**File:** `app/Console/Commands/IndexBlockchainEventsCommand.php`

| Item | Status |
|------|--------|
| Contracts indexed | CommunityEngine, Participation, ICO |
| RPC endpoint | `config('blockchain.rpc_url')` (Testnet) |
| Chain ID validated | Yes — live RPC must match `config('blockchain.chain_id')` |
| Addresses from config | Yes — `config('blockchain.contracts.*')` |
| Duplicate events prevented | Yes — unique on `tx_hash` + `log_index`; ICO purchases deduped |
| Mainnet guard | Refuses index on chain 56 when `CONFIRM_TESTNET_DEPLOYMENT` set |
| Dry-run mode | `--dry-run` — no DB writes, no transactions |

### Indexer dry-run result

```
Indexer network=bsc_testnet chain_id=97
PASS: Testnet chain 97 confirmed on RPC
DRY-RUN: latest block 130727411
DRY-RUN: start_block 130723087
DRY-RUN contract: 0xc0d9dee1476d67379069444a7e5f1b340f91f4e9
DRY-RUN contract: 0x9bf2e3405c0cb666c6664bd7651dab3f656feda5
DRY-RUN contract: 0x9c227938885f5fe4f91826ec6db37ea54ac31c73
DRY-RUN complete — no DB writes, no transactions.
```

**INDEXER_TESTNET_CONNECTION: PASS**

---

## Frontend configuration

Inertia shared prop `blockchain` (from `HandleInertiaRequests`) exposes:

- `chain_id`, `network`, `is_testnet`, `rpc_url`
- `contracts` map from Laravel config
- `web3`, `token`, `ico` payloads from `BlockchainContractPayload`

### Changes made

| File | Change |
|------|--------|
| `resources/js/lib/web3Deposit.js` | Chain-aware wallet switch (97 / 56); TestnetMockUSDT validation via `configureWeb3Network()` |
| `resources/js/app.jsx` | Syncs wallet helpers from Inertia `blockchain` props on load and navigation |
| `resources/js/Pages/Token/RaceToken.jsx` | Testnet network labels when `config.is_testnet` |
| `app/Models/SiteSetting.php` | Deposit payload uses configured chain ID + USDT |

Wallet pages (Dashboard, ICO, Deposit, Swap, Token) consume `blockchain.chain_id` and contract addresses from Inertia — no second hardcoded address list.

**FRONTEND_TESTNET_CONFIG: PASS** (code/config wiring verified; browser wallet flow not manually executed in this session)

---

## Client UAT readiness

| Check | Ready? |
|-------|--------|
| Wallet connects to BSC Testnet (chain 97) | Config wired — **manual test pending** |
| RaceCoin / ICO / Engine / Oracle resolve | **PASS** (bytecode + config) |
| TestnetMockUSDT used | **PASS** |
| ICO purchase UI → Testnet contract | **PASS** (Inertia `ico.ico_contract`) |
| Flexible post-ICO rule | Unchanged (business logic not modified) |
| No Mainnet transactions | Guarded by chain 97 config + wallet switch |
| Community Governance UI | **BLOCKED** — `RACE_GOVERNANCE_CONTRACT` not deployed |
| Liquidity locker | **BLOCKED** — not deployed |

**CLIENT_UAT_READY: FAIL** — automated wiring complete; run manual MetaMask UAT on `/ico`, `/race-token`, and Dashboard.

---

## Commands executed

```powershell
cd c:\xampp\htdocs\Rynexcapital
php artisan optimize:clear
php artisan blockchain:verify-testnet
php artisan blockchain:index-events --dry-run
php artisan tinker --execute="echo 'chain_id='.config('blockchain.chain_id').PHP_EOL; echo 'ico='.config('blockchain.contracts.ico').PHP_EOL;"
```

---

## Remaining blockers

1. **Manual browser UAT** — connect MetaMask to BSC Testnet and exercise ICO / stake / swap flows.
2. **RaceGovernance** — not deployed on Testnet; Governance page will show empty/missing contract until `deploy:governance:testnet` is run separately.
3. **RaceLiquidityLocker** — null in manifest; locker features remain unavailable on Testnet.
4. **Deposit treasury** — `ADMIN_WALLET_BEP20` still points to a legacy address; on-chain ICO/engine flows use deployed contracts, but member deposit page treasury may need Testnet treasury address for deposit UAT.

---

## Safety confirmations

- **No Solidity contract deployed or redeployed** in this wiring task.
- **Mainnet deployment not executed.**
- **No income/reward/ICO/staking business logic modified.**
- **No private keys printed or committed.**
