# RaceIncomeVault — deployment plan (testnet only)

## Preconditions

- Core contracts deployed and frozen (`deployment.json` on BSC testnet chainId **97**)
- USDT testnet address from manifest (`usdt`)
- Multisig/treasury addresses for fee recipient (default: `raceMultiSig`)
- Dedicated **`INCOME_VAULT_SETTLEMENT_SIGNER`** (EOA or controlled key — not Laravel HTTP trust)
- **`INCOME_VAULT_LIQUIDITY_POOL`** wallet funded with USDT + `approve` on vault

## Hard gates (script)

| Env | Required |
|-----|----------|
| `DEPLOY_ENV` | `testnet` |
| `CONFIRM_TESTNET_DEPLOYMENT` | `YES` |
| `CONFIRM_INCOME_VAULT_DEPLOY` | `YES` |
| `chainId` | `97` (reverts on 56) |

## Command

```bash
cd contracts
CONFIRM_INCOME_VAULT_DEPLOY=YES DEPLOY_ENV=testnet CONFIRM_TESTNET_DEPLOYMENT=YES \
INCOME_VAULT_SETTLEMENT_SIGNER=0x... \
INCOME_VAULT_ADMIN_FEE_RECIPIENT=0x6E043A778FBD5B372BFB8a41746A42e2EdE3c64a \
INCOME_VAULT_LIQUIDITY_POOL=0x... \
npx hardhat run scripts/deploy-income-vault-testnet.js --network bscTestnet
```

## Constructor args

1. `initialOwner` — deployer (transfer to MultiSig via separate governed tx if desired)  
2. `incomeToken` — manifest `usdt`  
3. `settlementSigner`  
4. `adminFeeRecipient`  
5. `incomeLiquidityPool`

## Post-deploy (manual)

1. Record `deployments/bscTestnet/income-vault.json`
2. Set Laravel `.env`: `RACE_INCOME_VAULT_CONTRACT`, `INCOME_VAULT_*`
3. Enable indexer for vault address
4. Run `php artisan income:migration-report`
5. **Do not** enable `INCOME_VAULT_AUTHORITATIVE=true` until migration plan approved
6. Verify contract on BscScan testnet
7. Hardhat: `test/security/RaceIncomeVaultSecurity.test.js`

## Explicit non-actions

- No RaceCoin / Engine / ICO / Vault redeploy  
- No minter or ownership changes on existing contracts  
- No mainnet deploy  
- No automatic legacy balance migration

## Output record fields

- `raceIncomeVault` address  
- `settlementToken`  
- `settlementSigner`  
- `adminFeeRecipient`  
- `incomeLiquidityPool`  
- `chainId`: 97  
- `deployTx`  
- `verificationStatus`: PENDING_MANUAL_BSCSCAN
