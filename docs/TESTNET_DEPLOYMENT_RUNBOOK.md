# Testnet Deployment Runbook

**TESTNET ONLY. Never deploy BSC Mainnet with this runbook.**

## STEP 1 — Create Testnet wallet

Create a dedicated wallet for BSC Testnet (chain 97). Fund it with **tBNB** only.

## STEP 2 — Local `.env`

```bash
cd contracts
copy .env.example .env
```

Put the Testnet **private key** only in `contracts/.env`:

```env
DEPLOYER_PRIVATE_KEY=...
DEPLOY_ENV=testnet
CONFIRM_TESTNET_DEPLOYMENT=YES
```

Also set Multisig signers, Testnet USDT, Pancake router, RPC. Never commit `.env`. Never paste keys in chat.

## STEP 3 — Get tBNB

Follow `docs/TESTNET_FAUCET_GUIDE.md` (manual faucet / CAPTCHA).

Target: **≥ 0.20 tBNB** (prefer **0.30**).

## STEP 4 — Balance check

```bash
npm run check:testnet-balance
```

## STEP 5 — Wallet check

```bash
npm run check:testnet-wallets
```

Optional report:

```bash
npm run report:testnet-wallets
```

## STEP 6 — Fix MISSING variables

Preflight requires:

- `DEPLOY_ENV=testnet`
- `CONFIRM_TESTNET_DEPLOYMENT=YES`
- 5 Multisig signers
- `TESTNET_USDT_ADDRESS` or `USDT` (Testnet only)
- `PANCAKE_ROUTER_ADDRESS` or `PANCAKE_ROUTER` (Testnet only)

```bash
npm run preflight:testnet
```

## STEP 7 — Deploy (operator only)

```bash
npm run deploy:testnet
```

This runs preflight first. On success, writes:

`contracts/deployments/bscTestnet/deployment.json`

Do **not** run Mainnet deploy.

## STEP 8 — Post-deploy check

```bash
npm run check:testnet-deployment
```

## STEP 9 — Explorer

Verify contracts on BscScan **Testnet** when supported. Record addresses from `deployment.json`.

## STEP 10 — Smoke tests (tiny amounts)

1. Connect wallet → chainId **97**
2. Confirm tBNB / Test USDT / RACE balances
3. Approve Test USDT
4. Tiny ICO purchase
5. Verify stake / claim / compound where allowed
6. Harmless MultiSig confirm path
7. Harmless Governance proposal path (no mint/treasury drain)

See also: funding guide, preflight, prior audit docs.

## Status meanings

| Status | Meaning |
|--------|---------|
| Preflight PASS | Env/network/gas config OK to attempt deploy |
| Deployment PASS | Live Testnet txs succeeded + artifacts saved |
| Production ready | **Never** claimed from Testnet alone |
