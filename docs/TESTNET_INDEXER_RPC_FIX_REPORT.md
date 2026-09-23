# BSC Testnet Indexer RPC Fix Report

**Date:** 2026-09-13  
**Environment:** BSC Testnet only (chain ID **97**)  
**No contracts redeployed. No Solidity changes. Mainnet not executed.**

---

## Final status

| Check | Result |
|-------|--------|
| INDEXER_RPC | **PASS** |
| INDEXER_SCAN | **PASS** |
| KNOWN_ICO_TX_DISCOVERED | **PASS** |
| ICO_PURCHASE_INDEXED | **PASS** |
| BLOCKCHAIN_EVENTS_INDEXED | **PASS** |
| MAINNET_EXECUTED | **NO** |

---

## Previous failure

```
php artisan blockchain:index-events
→ eth_getLogs failed for 0xc0d9dee...
```

**Root cause:** Primary RPC `https://data-seed-prebsc-1-s1.binance.org:8545` returned JSON-RPC `-32005 limit exceeded` on `eth_getLogs` for multi-thousand-block ranges. The indexer had no RPC fallback, no retries, and no block-range splitting.

**Database before fix:**

| Table | Count |
|-------|------:|
| `blockchain_events` | 0 |
| `ico_purchases` | 0 |
| `blockchain_index_state` | 0 rows |

---

## Changes made (configuration + indexer transport only)

### 1. `app/Services/Blockchain/BscJsonRpcClient.php` (new)

- Ordered RPC endpoint list from config
- Chain ID validation (`eth_chainId` must match configured `97`)
- Transient error retries (max 3 per endpoint, exponential backoff)
- `eth_getLogs` chunking via `BLOCKCHAIN_INDEXER_LOG_CHUNK` (default **250** blocks)
- Automatic binary split of a chunk when provider still rejects the range (max depth 12)
- Merged logs sorted by `blockNumber`, then `logIndex`
- Connection/timeout exceptions caught (no uncaught `ConnectionException`)

### 2. `app/Console/Commands/IndexBlockchainEventsCommand.php`

- Uses `BscJsonRpcClient` instead of single-endpoint `Http::post`
- Prints primary + fallback RPC hosts on startup
- Fails command if any contract index fails (preserves partial DB writes per successful contract)
- **Event mappings unchanged**

### 3. `config/blockchain.php`

- `rpc_urls` — primary + fallbacks from `.env`
- `indexer.log_chunk_size`, `indexer.rpc_retries`, `indexer.rpc_timeout`
- `indexer.rpc_urls` — indexer-specific list (falls back to `BSC_RPC_*` when indexer vars unset)

### 4. `.env` (Laravel root)

```env
BSC_RPC_URL=https://bsc-testnet.publicnode.com
BSC_RPC_URL_FALLBACK_1=https://data-seed-prebsc-2-s1.binance.org:8545
BSC_RPC_URL_FALLBACK_2=https://data-seed-prebsc-1-s2.binance.org:8545
BLOCKCHAIN_INDEXER_START_BLOCK=130723087
BLOCKCHAIN_INDEXER_LOG_CHUNK=250
BLOCKCHAIN_INDEXER_RPC_RETRIES=3
```

**Note:** If a shell session exports `BSC_RPC_URL`, it overrides `.env` (Laravel dotenv behavior). Clear it before indexing: `Remove-Item Env:BSC_RPC_URL -ErrorAction SilentlyContinue` (PowerShell).

---

## Selected RPC source

| Role | URL |
|------|-----|
| Primary | `https://bsc-testnet.publicnode.com` (from `BSC_RPC_URL`) |
| Fallback 1 | `https://data-seed-prebsc-2-s1.binance.org:8545` |
| Fallback 2 | `https://data-seed-prebsc-1-s2.binance.org:8545` |

Live `eth_chainId`: **97**

---

## Indexer parameters

| Setting | Value |
|---------|------:|
| Start block | **130723087** |
| Batch size (outer per run) | 2000 |
| Log chunk size | **250** |
| RPC retries per endpoint | **3** |
| RPC timeout | 25s |

---

## Verification commands

```powershell
cd c:\xampp\htdocs\Rynexcapital
Remove-Item Env:BSC_RPC_URL -ErrorAction SilentlyContinue
php artisan optimize:clear
php artisan blockchain:index-events --dry-run
php artisan blockchain:index-events
php scripts/client-uat-db-check.php
php scripts/verify-known-ico-tx.php
```

### Dry-run result

```
Indexer network=bsc_testnet chain_id=97
RPC primary: https://bsc-testnet.publicnode.com
PASS: Testnet chain 97 confirmed on RPC
DRY-RUN: latest block 130739623
DRY-RUN: start_block 130723087
DRY-RUN: log_chunk_size 250
DRY-RUN: rpc_retries 3
DRY-RUN complete — no DB writes, no transactions.
```

### Real indexer result

```
Indexed 0xc0d9dee... blocks 130723087–130725086 (4 logs).
Indexed 0x9bf2e340... blocks 130723087–130725086 (0 logs).
Indexed 0x9c227938... blocks 130723087–130725086 (5 logs).
```

---

## Known ICO transaction

**Tx:** `0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8`  
**Block:** `130724727`

### Discovery result

| Check | Result |
|-------|--------|
| `ICOPurchased` in `blockchain_events` | **YES** (log_index 27) |
| Related engine events same tx | `ICOStakeCreated`, `ParticipationPurchased`, + mapped engine logs |
| `RaceMintedToStaking` on ICO contract | **YES** (log_index 29) |
| Unmapped topics stored as `Unknown` | 3 logs (ERC20 Transfer / admin events — mapping not changed by design) |

### `ico_purchases` row

| Field | Value |
|-------|-------|
| `tx_hash` | `0xd6a8025c…cf9f8` |
| `wallet_address` | `0xb836f0a8b9014a0431abe7710eab818dcd7ae984` |
| `phase` | 1 |
| `usdt_amount` | 1.000000000000000000 |
| `race_amount` | 4.000000000000000000 |
| `price` | 0.250000000000000000 |
| `block_number` | 130724727 |
| `purchase_id` | 0 (indexed topic — matches on-chain first purchase) |

---

## Database after fix

| Table | Before | After |
|-------|-------:|------:|
| `blockchain_events` | 0 | **9** |
| `ico_purchases` | 0 | **1** |
| `blockchain_index_state` rows | 0 | **3** (engine, participation, ico → block 130725086) |
| Duplicate ICO rows | 0 | **0** |

Re-running `php artisan blockchain:index-events` does not duplicate rows (`tx_hash` + `log_index` guard preserved).

---

## Safety confirmations

- Chain ID remains **97**; Mainnet not executed
- No Solidity / tokenomics / ICO business logic changed
- Event topic map unchanged; only transport reliability improved
- Indexer remains read-only (no transactions sent)
