# Testnet tBNB Transfer Utility

**Network:** BNB Smart Chain Testnet (chain ID **97**) only  
**Token:** native **tBNB** (test BNB — not real BNB)  
**Mainnet (56):** rejected by script

This utility sends tBNB from the **deployer wallet** (`DEPLOYER_PRIVATE_KEY` in `contracts/.env`) to any test wallet. It does **not** deploy contracts or modify Solidity.

---

## Prerequisites

| Requirement | Value |
|-------------|--------|
| `DEPLOY_ENV` | `testnet` (in `contracts/.env`) |
| `DEPLOYER_PRIVATE_KEY` | Valid deployer key (never commit; never print) |
| Deployer balance | Enough for `TRANSFER_AMOUNT` + gas |
| Confirmation | `CONFIRM_TBNB_TRANSFER=YES` |

Check deployer balance first:

```powershell
cd contracts
npm run check:testnet-balance
```

---

## Command

```powershell
cd c:\xampp\htdocs\Rynexcapital\contracts
$env:TRANSFER_TO="0x45FC20CdC8c36F69b02C4a6107C80805aDd9066f"
$env:TRANSFER_AMOUNT="0.05"
$env:CONFIRM_TBNB_TRANSFER="YES"
npm run transfer:testnet-tbnb
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRANSFER_TO` | Yes | Recipient EVM address (checksum optional) |
| `TRANSFER_AMOUNT` | Yes | Positive tBNB amount (e.g. `0.05`) |
| `CONFIRM_TBNB_TRANSFER` | Yes | Must be exactly `YES`; any other value is rejected |

Optional aliases (same behavior):

- `TESTNET_TBNB_TRANSFER_TO` → `TRANSFER_TO`
- `TESTNET_TBNB_TRANSFER_AMOUNT` → `TRANSFER_AMOUNT`

---

## Safety checks (script)

1. `DEPLOY_ENV` must be `testnet`
2. Connected `chainId` must be **97** (mainnet **56** hard-stopped)
3. `TRANSFER_TO` must be a valid non-zero EVM address
4. `TRANSFER_AMOUNT` must be `> 0`
5. Sender balance must cover amount + estimated gas
6. `CONFIRM_TBNB_TRANSFER=YES` required after preview lines
7. Private keys are never logged

---

## Output (public only)

Before broadcast (preview):

```
SENDER: 0x...
RECIPIENT: 0x...
AMOUNT: 0.05 tBNB
```

After success:

```
NETWORK: bscTestnet
CHAIN ID: 97
SENDER: 0x...
RECIPIENT: 0x...
AMOUNT: 0.05 tBNB
TX: 0x...
BLOCK: ...
SENDER_BALANCE_BEFORE: ...
SENDER_BALANCE_AFTER: ...
STATUS: PASS
```

---

## Script location

- `contracts/scripts/transfer-testnet-tbnb.js`
- npm: `transfer:testnet-tbnb` in `contracts/package.json`

---

## Security notes

- Do **not** add private keys to source control or this document.
- Use `contracts/.env` locally only (already gitignored).
- This tool is for **testnet funding** of MetaMask / test wallets — not for mainnet.
- If `CONFIRM_TBNB_TRANSFER` is unset or not `YES`, the script stops before sending.

---

## Related

- Deployer balance: `npm run check:testnet-balance`
- TEST-USDT mint: `npm run mint:testnet-usdt` (see `docs/TESTNET_BLOCKER_RESOLUTION.md`)
- External faucet: `docs/TESTNET_FAUCET_GUIDE.md`
