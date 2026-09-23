# Testnet Preflight

Run **before** `npm run deploy:testnet`.

```bash
cd contracts
npm run preflight:testnet
```

`deploy:testnet` runs preflight automatically and **STOPS** if it fails.

## Required

| Check | Rule |
|-------|------|
| Chain ID | Must be **97** |
| RPC | Must not be Mainnet RPC when `DEPLOY_ENV=testnet` |
| `DEPLOY_ENV` | Must be `testnet` |
| `CONFIRM_TESTNET_DEPLOYMENT` | Must be `YES` |
| Deployer key | Real Testnet key in `contracts/.env` (never logged) |
| Deployer tBNB | Must be **> 0** (warn if `< 0.20`) |
| Multisig | Exactly **5** unique non-zero addresses |
| USDT | Explicit Testnet address — **not** Mainnet USDT |
| Pancake router | Explicit Testnet address — **not** Mainnet router |

## Optional until governance deploy

| Check | Rule |
|-------|------|
| Governance members | 10–12 unique if set |
| `GOVERNANCE_THRESHOLD` | Default `7` (must be > 50% of members) |
| `ORACLE_UPDATER` | Valid address if set |
| `ICO_ADMIN_WALLET` | Defaults to deployer |

## Pass output (shape)

```
TESTNET PREFLIGHT
=================
Chain ID: 97
DEPLOY_ENV: testnet
Deployer: 0x...
tBNB: ...
Multisig signers: PASS
Governance members: PASS/OPTIONAL
Environment confirmation: PASS
Network safety: PASS

READY FOR TESTNET DEPLOYMENT
TESTNET PREFLIGHT: PASS
```

Preflight **PASS** means configuration looks ready. It does **not** mean contracts are audited or production ready.
