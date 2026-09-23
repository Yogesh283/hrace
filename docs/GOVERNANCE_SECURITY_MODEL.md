# GOVERNANCE SECURITY MODEL

## Boundaries

| Action | Allowed via |
|--------|-------------|
| Expense / company treasury withdraw | RaceMultiSig only |
| Change Multisig signers/threshold | **Impossible** (immutable); Governance cannot |
| Engine pause / set oracle | Community Governance **if** it owns Engine |
| Oracle price push | Ops updater EOA |
| RaceCoin mint | Authorized minters only; owner remains Multisig by default |
| User stake confiscation | **Forbidden** (no such Governance API) |

## Hard rules in RaceGovernance

- Members 10–12, unique, non-zero
- Threshold > 50% of members and ≤ member count
- Timelock ≥ 1 hour (cannot set to 0 via proposal)
- Targets whitelisted; self always governed
- No double vote / double execute
- Execute only after queue + timelock
- Config changes only via self-call (proposal)

## Explicitly out of scope

- Modifying `RaceMultiSig.sol`
- Token-weighted voting (use legacy RaceGovernor if needed)
- Bypassing MAX_SUPPLY / EMI / ROI / Team Reward / Admin Fee logic
