# Oracle Decentralization Plan (Design)

## Current

`RaceRewardPriceOracle` — privileged updater (historically deployer; owner MultiSig on testnet manifest).

## Risks

- Single updater compromise → wrong RACE/USDT price for engine rewards.

## Future options (no economics change)

- Multi-source median with deviation cap
- Stale price heartbeat + pause engine claims
- Chainlink-style external feed adapter **new contract** — wire via `setRewardPriceOracle` on engine (governed)

**Live oracle bytecode:** NOT MODIFIED in this track.
