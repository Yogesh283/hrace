# GOVERNANCE ARCHITECTURE

## Two separate layers

```
Community Governance (RaceGovernance)
  10–12 wallets · 1 vote each · threshold >50% · timelock
        ↓
  Protocol configuration (pause, oracle params, ICO phase, etc.)

RaceMultiSig (UNCHANGED)
  5 signers · threshold 3
        ↓
  Treasury / expense fund withdrawals · security releases
```

**Governance is NOT a replacement for MultiSig.**

## Legacy RaceGovernor

`RaceGovernor.sol` = stake-weighted DAO (keeps existing deploy wiring to RaceCoin/Staking/RewardPool `governance` where already set).

`RaceGovernance.sol` = new community **wallet** governance.

## Proposal lifecycle

1. Member `propose(target, value, data, descriptionHash)` — target must be governed
2. Members `castVote` (for/against), no duplicates
3. After vote end: `queue` if `forVotes >= threshold` (quorum = same absolute bar)
4. Wait `timelockDelay`
5. Member `execute` — one-shot call to target

Self-config (`addMember`, `setThreshold`, targets, periods) only via `msg.sender == address(this)` (executed proposal).

## Tokenomics / income

Unchanged. Governance must not mint around MAX_SUPPLY, alter EMI/ROI/Team Reward formulas, or bypass Multisig treasury withdraw.
