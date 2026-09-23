# GOVERNANCE OPERATIONS

## Testnet deploy (only)

```bash
cd contracts
# contracts/.env — BSC testnet key + members
GOVERNANCE_MEMBERS=0x1,0x2,...,0x12
GOVERNANCE_THRESHOLD=7
GOVERNANCE_VOTING_PERIOD_SECONDS=259200
GOVERNANCE_TIMELOCK_SECONDS=86400
GOVERNANCE_INITIAL_TARGETS=0xEngine,0xOracle

npm run deploy:governance:testnet
```

Mainnet Governance deploy is **refused** by `deploy-governance-testnet.js`.

## After deploy

1. Set Laravel `RACE_GOVERNANCE_CONTRACT=`
2. Register additional targets via governance proposal to `registerGovernedTarget`
3. Transfer Ownable of Engine/Oracle/ICO to Governance **only** after Multisig (current owner) executes `transferOwnership` — not automatic for RaceCoin

## How members vote

1. Connect wallet that is a governance member
2. Open Governance UI / call contract
3. Vote For/Against during voting window
4. After end + enough yes votes: any member queues
5. After timelock: any member executes

## MultiSig ops (unchanged)

Treasury / Dev / Marketing / Ops withdrawals still require RaceMultiSig 3-of-5. Governance cannot call those withdraws unless Multisig itself is the caller (Governance is not Multisig).
