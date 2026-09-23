# RaceIncomeVault — BSC Testnet Deployment Readiness

**Generated:** 2026-09-19  
**Project:** `C:\xampp\htdocs\Rynexcapital`  
**Deployment executed:** **NO** (readiness only)

---

## Verdict

| Status | **BLOCKED** |
|--------|-------------|

Deploy **STOP** until required env vars are set and operator explicitly confirms. Do **not** set `INCOME_VAULT_AUTHORITATIVE=true` as part of deploy.

---

## Script & contract review (inspected)

| Item | Path | Notes |
|------|------|--------|
| Deploy script | `contracts/scripts/deploy-income-vault-testnet.js` | chainId **97** only; rejects **56**; writes `deployments/bscTestnet/income-vault.json` |
| Vault | `contracts/src/RaceIncomeVault.sol` | Constructor: `(owner, usdt, settlementSigner, adminFeeRecipient, incomeLiquidityPool)` |
| Fees | `contracts/src/lib/IncomeVaultFeeLib.sol` | Unchanged business fee rules |
| Manifest | `contracts/deployments/bscTestnet/deployment.json` | USDT + MultiSig + deployer |

**Core contracts:** deploy script does **not** modify RaceCoin, Engine, ICO, Vault, Treasury, MultiSig.

---

## Chain & RPC

| Check | Result |
|-------|--------|
| Laravel `.env` `BSC_CHAIN_ID` | **97** |
| Laravel `.env` `BSC_NETWORK` | `bsc_testnet` |
| Laravel RPC | `https://bsc-testnet.publicnode.com` (+ testnet fallbacks) — **not mainnet** |
| Hardhat `bscTestnet` network | `chainId: 97`, RPC from `BSC_TESTNET_RPC` in `contracts/.env` |
| Live RPC `eth_chainId` (spot check) | **97** |

---

## USDT (TestnetMockUSDT)

| Source | Address |
|--------|---------|
| `deployment.json` → `usdt` | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| Root `.env` `USDT_CONTRACT_BEP20` | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| `contracts/.env` `USDT` / `TESTNET_USDT_ADDRESS` | Same |

**Match expected TestnetMockUSDT:** **YES**

Deploy uses **`manifest.usdt`** (above), not a separate env override in the script.

---

## MultiSig / security (manifest)

| Role | Address |
|------|---------|
| RaceMultiSig | `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` |
| Threshold | 3-of-5 |
| Default `adminFeeRecipient` (if env unset) | Same MultiSig |

---

## Environment variables

### Required for deploy script (must be non-empty at run time)

| Variable | In `contracts/.env`? | In root `.env`? | Status |
|----------|------------------------|-----------------|--------|
| `DEPLOYER_PRIVATE_KEY` | **Set** (value not documented here) | — | OK |
| `DEPLOY_ENV` | `testnet` | — | OK |
| `CONFIRM_TESTNET_DEPLOYMENT` | `YES` | — | OK |
| `CONFIRM_INCOME_VAULT_DEPLOY` | **Missing** | **Missing** | **REQUIRED at deploy** |
| `INCOME_VAULT_SETTLEMENT_SIGNER` | **Missing** | **Missing** | **BLOCKER** |

### Optional (script defaults)

| Variable | Status | Effective value if unset |
|----------|--------|---------------------------|
| `INCOME_VAULT_LIQUIDITY_POOL` | **Missing** | `manifest.deployer` → `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` |
| `INCOME_VAULT_ADMIN_FEE_RECIPIENT` | **Missing** | `manifest.raceMultiSig` |

### Post-deploy Laravel (not required to run deploy script)

| Variable | Status |
|----------|--------|
| `RACE_INCOME_VAULT_CONTRACT` | Not set (set after deploy) |
| `INCOME_VAULT_ENABLED` | Default false in config |
| `INCOME_VAULT_AUTHORITATIVE` | **Must remain false** for this task |

### Missing env summary (exact)

1. **`INCOME_VAULT_SETTLEMENT_SIGNER`** — **must be a valid checksummed BSC testnet address (0x + 40 hex)** controlled by your settlement key policy. **Not present in repo env files.**
2. **`CONFIRM_INCOME_VAULT_DEPLOY=YES`** — must be set in shell or `contracts/.env` immediately before deploy (safety gate).

**Optional but recommended before first `creditIncome`:**

3. **`INCOME_VAULT_LIQUIDITY_POOL`** — explicitly set if liquidity should **not** be the deployer EOA (currently would default to deployer).

---

## Address validation

| Address | Role | Valid format | Notes |
|---------|------|--------------|--------|
| `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` | Deployer (from key) | OK | Matches `deployment.json` `deployer` |
| `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` | USDT | OK | 18 decimals on testnet mock |
| `0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a` | MultiSig / default admin fee | OK | |
| **Settlement signer** | — | **Not configured** | Cannot validate until `INCOME_VAULT_SETTLEMENT_SIGNER` is set |

**Do not use mainnet addresses or mainnet RPC while deploying.**

---

## Balances (RPC read, 2026-09-19)

Wallet used as **default liquidity pool** (deployer = `0xB836…`):

| Asset | Balance |
|-------|---------|
| tBNB | **0.185768928145** |
| TEST-USDT | **1100.0** |

`npm run check:testnet-balance` tier: **LOW** (below recommended 0.2 tBNB, above zero). Deploy may still succeed; prefer ≥ **0.2** tBNB.

If `INCOME_VAULT_LIQUIDITY_POOL` points to another wallet, **re-run balance checks on that address** before crediting income.

---

## Expected USDT approval (post-deploy, not deploy gas)

Deploy **does not** require USDT approval. After vault address is known:

- **`incomeLiquidityPool`** must call `USDT.approve(raceIncomeVault, amount)` before any `creditIncome` / `migrateIncome`.
- **Amount:** operator-defined (e.g. planned migration + runway). **Not fixed by repo.** Use an explicit budget; unlimited approval is a trust decision document separately.
- Pool wallet needs **tBNB** only for approval tx gas (small); **USDT** for actual credits.

---

## Deployment command (do not run until BLOCKED items cleared)

From `contracts/`:

```powershell
$env:DEPLOY_ENV="testnet"
$env:CONFIRM_TESTNET_DEPLOYMENT="YES"
$env:CONFIRM_INCOME_VAULT_DEPLOY="YES"
$env:INCOME_VAULT_SETTLEMENT_SIGNER="0xYourSettlementSignerAddress"
# Optional:
# $env:INCOME_VAULT_LIQUIDITY_POOL="0x..."
# $env:INCOME_VAULT_ADMIN_FEE_RECIPIENT="0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a"

npx hardhat run scripts/deploy-income-vault-testnet.js --network bscTestnet
```

Or add the same keys to `contracts/.env` (never commit private keys).

**Do not use `--network bsc` (mainnet).**

---

## Post-deployment verification (after deploy only)

```powershell
# Record output: deployments/bscTestnet/income-vault.json

# Laravel (root .env — do NOT set AUTHORITATIVE yet):
# RACE_INCOME_VAULT_CONTRACT=<vault from json>
# INCOME_VAULT_ENABLED=true

cd C:\xampp\htdocs\Rynexcapital\contracts
npx hardhat compile

# On-chain read (replace VAULT):
# owner(), settlementSigner(), adminFeeRecipient(), incomeLiquidityPool(), incomeToken()

cd C:\xampp\htdocs\Rynexcapital
php artisan migrate
php artisan income:index-vault
php artisan income:reconcile-onchain
php artisan income:migration-report
```

Hardhat tests (pre/post):

```powershell
cd contracts
npx hardhat test test/security/RaceIncomeVaultSecurity.test.js
```

---

## Operator checklist before GO

- [ ] `INCOME_VAULT_SETTLEMENT_SIGNER` set to intended **testnet** address (not mainnet)
- [ ] Settlement key custody documented (off-repo)
- [ ] `CONFIRM_INCOME_VAULT_DEPLOY=YES` set for one deploy run
- [ ] Liquidity pool wallet chosen; USDT + tBNB sufficient
- [ ] `INCOME_VAULT_AUTHORITATIVE` remains **false**
- [ ] No core contract redeploy planned in same window

---

## Summary

| Field | Value |
|-------|--------|
| **READY / BLOCKED** | **BLOCKED** |
| **Primary blocker** | Missing **`INCOME_VAULT_SETTLEMENT_SIGNER`** |
| **Secondary** | **`CONFIRM_INCOME_VAULT_DEPLOY=YES`** not in env until deploy moment |
| **Chain ID** | **97** |
| **USDT** | `0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc` |
| **Deployer** | `0xB836F0A8B9014a0431aBe7710EaB818dCd7AE984` |
| **Default liquidity pool** | Same as deployer if env unset |
| **Deployer tBNB** | 0.1858… (LOW tier) |
| **Liquidity USDT** | 1100.0 (deployer wallet) |

**Deployment was not executed in this task.**
