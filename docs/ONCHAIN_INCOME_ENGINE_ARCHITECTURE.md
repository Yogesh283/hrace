# On-Chain Income Engine Architecture (Design Only)

**No deployment.** Additive contracts only if parity tests pass.

## Proposed (optional) modules

| Contract | Responsibility | Trust |
|----------|----------------|-------|
| **RaceIncomeVault** (exists) | Ledger, withdraw, fees, signed credit/migrate | Settlement signer + liquidity pool |
| **RaceReferralRegistry** (future) | Immutable referrer per wallet at registration | Owner sets once; no balance mutation |
| **RaceIncomeSettlementVerifier** (future) | On-chain verify Merkle root of daily ROI batch | Signer submits root + proofs |
| **RaceTeamRewardEngine** (future) | Verify L1–L10 splits match signed withdrawal payload | Already in vault via TeamWithdrawSettlement |

## Interaction with core

- **No changes** to RaceCoin, Engine, ICO, Vault, Treasury, MultiSig.
- Laravel remains calculator until Merkle/settlement parity proven.

## Gas

Full 10-level tree on-chain daily = high cost → prefer **signed batch settlement** (current vault design).
