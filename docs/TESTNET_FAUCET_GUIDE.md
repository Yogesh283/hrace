# Testnet tBNB Faucet Guide

**Manual only.** This project does **not** automate faucets, CAPTCHA, or bot protection bypasses. Do **not** store faucet credentials in the repo.

## Steps

1. Open MetaMask (or another wallet) and select **BNB Smart Chain Testnet** (chain ID **97**).
2. Copy your **deployer** address (public address only — never share the private key).
3. Claim **tBNB** from an official / commonly used BSC Testnet faucet (search current Binance / community faucet docs; URLs change).
4. Complete any CAPTCHA / human checks **yourself**.
5. Wait for confirmation on the Testnet explorer.
6. From the project:

```bash
cd contracts
npm run check:testnet-balance
```

7. Repeat only according to faucet rate limits / rules.

## Notes

- You need **tBNB**, not real BNB, for gas on Testnet.
- Test USDT is separate — use a Testnet USDT / mock configured in `.env` (`TESTNET_USDT_ADDRESS` or `USDT`). Do **not** use Mainnet USDT.
- If the faucet fails, wait and retry later — do not script abuse.
