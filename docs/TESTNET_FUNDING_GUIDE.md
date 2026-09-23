# Testnet Funding Guide

**Network:** BNB Smart Chain Testnet (chain ID **97**)  
**Native gas token:** **tBNB** (test BNB) — **not** real BNB

Real BNB is **not** required for Testnet deployment. Testnet **tBNB** is required for gas.

## Who needs tBNB?

| Role | Needs gas? | When |
|------|------------|------|
| **DEPLOYER** | **YES** | Contract deployment + post-deploy configuration txs |
| **MULTISIG SIGNERS** | Only when signing | Submit / confirm / execute MultiSig txs on Testnet |
| **GOVERNANCE MEMBERS** | Only when acting | Proposal / vote / queue / execute on Testnet |
| **ORACLE_UPDATER** | Only when updating | Price push txs |
| **ICO_ADMIN** | Usually no | Proceeds wallet; gas only if it sends txs |
| **TEST USERS** | For their own txs | Approve, buy ICO, stake, claim, etc. |

Do **not** require every Multisig/Governance wallet to hold tBNB before deployment. Only the **deployer** must have gas to deploy.

## Recommended deployer balance

| Tier | Amount | Meaning |
|------|--------|---------|
| ZERO | `0` | **STOP** — cannot deploy |
| LOW | `< 0.20` tBNB | Warning — may work; prefer more |
| SUFFICIENT | `≥ 0.20` tBNB | Recommended minimum |
| Preferred | `≥ 0.30` tBNB | Comfortable headroom |

These tiers are **advisory**. They do **not** guarantee gas cost. Exact gas depends on network conditions and which contracts deploy.

## Commands

```bash
cd contracts
npm run check:testnet-balance
npm run check:testnet-wallets
npm run report:testnet-wallets
npm run preflight:testnet
```

## Safety

- Never put mainnet private keys in `contracts/.env` for testnet work.
- Never commit `.env`.
- Never print private keys in logs or chat.
- Faucet CAPTCHA must be completed **manually** — no bot bypass.
