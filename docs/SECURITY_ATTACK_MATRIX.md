# RACE Ecosystem — Security Attack Matrix

**Legend:** ✅ No unprivileged path | ⚠️ Trusted-role / ops risk | ❌ Exploit path (fix required) | 🔶 Griefing / partial

| Attack goal | Unprivileged external attacker | 1 MS signer | 2 MS signers | 3 MS signers | Oracle updater | Laravel admin | Legacy contract user |
|-------------|-------------------------------|-------------|--------------|--------------|----------------|---------------|------------------------|
| Mint RACE | ✅ | ✅ | ✅ | ❌ via MS tx | ⚠️ via price + engine | ⚠️ hybrid ledger only | ✅ (Participation uses transfer not mint) |
| Steal ICO USDT | ✅ | ✅ | ✅ | ❌ if adminWallet key | ✅ | ✅ | ✅ |
| Drain RaceTreasury RACE | ✅ | ✅ | ✅ | ❌ MS→treasury.withdraw | ✅ | ✅ | ✅ |
| Steal another user's staked principal | ✅ | ✅ | ✅ | ⚠️ pause/upgrade engine | ✅ | ✅ | ✅ separate contract |
| Steal another user's accrued reward | ✅ | ⚠️ forced claim to user wallet | same | same | ⚠️ price timing | ⚠️ virtual ledger | ✅ |
| Double-claim same reward epoch | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ if hybrid dup credit | ✅ |
| Bypass claim cooldown | ✅ | ✅ | ✅ | ✅ | ✅ | N/A on-chain | ✅ |
| Bypass maturity / EMI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Bypass ICO cap | ✅ | ✅ | ✅ | ❌ could start bad phase | ✅ | ✅ | ✅ |
| Bypass MultiSig threshold | ✅ | ✅ | ✅ | ❌ needs 3 keys | ✅ | ✅ | ✅ |
| Bypass governance timelock | ✅ (if gov not deployed) | ✅ | ✅ | ⚠️ if gov misconfigured | ✅ | ✅ | ⚠️ RaceGovernor legacy |
| Manipulate oracle (unauthorized) | ✅ | ✅ | ✅ | ❌ MS sets updater | ❌ if key stolen | ✅ | ✅ |
| Flash-loan governance vote | ✅ wallet-vote model | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ legacy stake-weight if used |
| Laravel tx hash spoof compound | ✅ if verifier bypass | ✅ | ✅ | ✅ | ✅ | ❌ insider | ✅ |
| Bind victim wallet (withdrawal addr) | 🔶 session hijack | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Drain Participation reward pool | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ if pool underfunded claims fail |

---

## Attack tree (executable path summary)

```
ATTACKER
├── Mint RACE
│   └── Unprivileged: NO (vault onlyEngine; minter onlyOwner-set)
│   └── Compromised minter/vault.engine/oracle: YES until MAX_SUPPLY
├── Steal USDT
│   └── ICO: NO on-chain (needs adminWallet key)
│   └── Engine participate: NO (USDT stays in Engine until swap)
├── Drain Treasury
│   └── Unprivileged: NO (msg.sender == multisig)
│   └── 3 signers: YES
├── Steal user reward
│   └── Pull from wallet: NO
│   └── Force claim to user (grief): YES (distributeReward public)
├── Bypass cooldown
│   └── On-chain: NO (tested)
├── Bypass maturity
│   └── NO (tested replay)
├── Exploit Laravel
│   └── Wallet connect without sig: YES (session attacker)
│   └── Compound verifier chain 97 lock: blocks mainnet verify
└── Legacy harm
    └── Parallel Participation + old Engine stakes: YES (user confusion / dual economy)
```

---

## MEV / ordering (informational)

| Flow | Risk |
|------|------|
| ICO `purchase` | Front-run phase fill — economic, not theft |
| `participate` swap | Sandwich on thin RACE pool |
| `claimReward` / `compound` | Permissionless `distributeReward` + oracle update ordering |
| Oracle `updatePrice` | Updater can move price within deviation bounds before user txs |

Flash loans: **not applicable** to `RaceGovernance` (wallet members). **Applicable** to legacy `RaceGovernor` if still wired and stake-weighted.
