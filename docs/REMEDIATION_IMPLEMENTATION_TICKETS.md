# Remediation Implementation Tickets

**Source:** `docs/READ_ONLY_REMEDIATION_PLAN.md`  
**Date:** 2026-09-14  
**Scope:** Documentation / tickets only — no code, deploy, or blockchain transactions in this artifact.

---

## TICKET C-1

**TICKET ID:** C-1  
**TITLE:** CommunityEngine claimEnabled + 24h cooldown deployment/relink  
**SEVERITY:** CRITICAL  
**AREA:** Smart contracts / deployment / config / frontend reads  

**CURRENT PROBLEM:**  
Deployed `RaceCommunityEngine` at `0xc0D9Dee1476D67379069444A7e5f1b340f91F4E9` does not expose repository claim-policy interface (`claimEnabled()`, `canClaimRewards()`, `lastSuccessfulClaimAt`, 24h cooldown in `_claimReward`). Live testnet Engine bytecode vs claim policy source mismatch.

**EVIDENCE:**  
- `deployment.json` note: *“Resumed post-deploy — contracts NOT redeployed.”*  
- Read-only probe with current ABI: `claimEnabled()` returns empty data (`eth_call` → `0x`).  
- Repository tests cover new selectors in `RaceCommunityEngineClaimPolicy.test.js`; frontend `readClaimPolicyState()` treats empty `eth_call` as `supported: false`.  
- Audit: **CRITICAL** finding C-1; summary table CommunityEngine **PARTIAL** / **HIGH** risk.

**TARGET STATE:**  
- Live Engine bytecode matches `RaceCommunityEngine.sol` claim policy.  
- `claimEnabled == false` by default until MultiSig calls `setClaimEnabled(true)` **after** `RaceICO.icoCompleted()`.  
- Successful `claimReward` updates `lastSuccessfulClaimAt[user]`; failed txs do not.  
- ICO, Vault, Oracle, Laravel, and frontend all reference **one** Engine address.  
- `readClaimPolicyState` returns `supported: true` on configured engine address.

**FILES / CONTRACTS INVOLVED:**  
- `contracts/src/RaceCommunityEngine.sol` — `claimEnabled`, `lastSuccessfulClaimAt`, `setClaimEnabled`, `canClaimRewards`, `_claimReward`, `ClaimEnabledUpdated`, `ClaimCooldownRecorded`  
- `contracts/scripts/deploy.js`, `contracts/scripts/check-testnet-deployment.js`, `contracts/scripts/uat-testnet-e2e.js`  
- `contracts/deployments/bscTestnet/deployment.json` — `raceCommunityEngine`, `linkages.vaultEngine`, `linkages.icoStakingEngine`  
- `RaceRewardVault`, `RaceICO` — relink only (no RaceCoin redeploy)  
- `resources/js/lib/web3Engine.js` — `readClaimPolicyState`, selectors  
- `config/blockchain.php`, Laravel `.env` — `RACE_COMMUNITY_ENGINE_CONTRACT`  
- `docs/CLAIM_ACTIVATION_24H_POLICY.md`  
- `contracts/test/RaceCommunityEngineClaimPolicy.test.js`

**DATABASE IMPACT:**  
- No schema change for Engine redeploy.  
- Operational: extend `blockchain_index_state` for new engine contract or new row; optional backfill `blockchain_engine_stakes` if address changes.  
- Historical `ico_purchases` / stakes on old engine remain valid; new purchases use relinked ICO.

**SMART CONTRACT IMPACT:**  
- Deploy **new** `RaceCommunityEngine` from current source (no tokenomics changes).  
- MultiSig txs: `vault.setEngine(newEngine)`, `ico.setStakingEngine(newEngine)`, new engine wiring (`setIcoContract`, `setRewardPriceOracle`, maturity treasury), `transferOwnership(MultiSig)`, post-ICO-complete `setClaimEnabled(true)`.  
- Legacy `0xc0D9…` marked **DEPRECATED**; stakes on old engine remain on-chain.

**BACKEND IMPACT:**  
- Update `config/blockchain.php` / `.env` when address changes.  
- Inertia shared `blockchain.contracts.community_engine` must match manifest.  
- Optional: health command / CI `eth_call` on `claimEnabled()` (fail if `0x`).

**FRONTEND IMPACT:**  
- Engine contract address from config only (no stale hardcoded testnet address after relink).  
- Claim policy UI uses `readClaimPolicyState` with `supported: true` after relink.  
- Optional UX: warning for users with stakes only on deprecated engine address.

**INDEXER IMPACT:**  
- New engine address in indexer contract list; cursor/rescan per ops plan.  
- `ClaimEnabledUpdated` / `ClaimCooldownRecorded` topic map already present; will apply once emitted on new deploy.

**DEPENDENCIES:**  
- MultiSig signers on testnet; backup `deployment.json` and DB.  
- Blocks: on-chain claim UAT, H-9 closure, testnet exit claim criteria.  
- C-2 compound verification should use stable engine address from this ticket.  
- H-2 can proceed in parallel.

**IMPLEMENTATION STEPS:**  
1. Backup manifest, `.env`, DB snapshot.  
2. Deploy new `RaceCommunityEngine` (testnet only; `DEPLOY_ENV=testnet`, chain 97).  
3. MultiSig: `RaceRewardVault.setEngine(newEngine)`.  
4. MultiSig: `RaceICO.setStakingEngine(newEngine)`; verify `adminWallet` unchanged.  
5. Wire new Engine: ICO, oracle, maturity treasury per `deploy.js` assertions.  
6. MultiSig: transfer Engine ownership if needed.  
7. Do **not** redeploy RaceCoin; minters remain ICO + Vault.  
8. After `RaceICO.icoCompleted()`: MultiSig `setClaimEnabled(true)` on new Engine only.  
9. Update `deployment.json` and Laravel `.env` / indexer start block if rescan needed.  
10. Document deprecated legacy Engine `0xc0D9…`.  
11. Run Hardhat claim policy tests and `check-testnet-deployment.js`.

**TESTS REQUIRED:**  
- `contracts/test/RaceCommunityEngineClaimPolicy.test.js` — full suite on fresh deploy.  
- `contracts/scripts/uat-testnet-e2e.js` — post-relink config checks.  
- Manual: `readClaimPolicyState` → `supported: true`.

**TESTNET VERIFICATION:**  
```powershell
cd c:\xampp\htdocs\Rynexcapital\contracts
npx hardhat test --grep "ClaimPolicy"
node scripts/check-testnet-deployment.js
# eth_call claimEnabled on NEW_ENGINE_ADDRESS — non-empty bool
cd c:\xampp\htdocs\Rynexcapital
php artisan blockchain:index-events
php scripts/verify-known-ico-tx.php
```
Confirm `vault.engine()` and `ico.stakingEngine()` equal new address.

**ROLLBACK PLAN:**  
- Restore previous `.env` and manifest backup.  
- Keep old Engine address live (immutable stakes); do not destroy old contract.  
- Revert Laravel deploy if config pointed to new address prematurely.  
- Dual-read period documented if needed.

**MAINNET IMPACT:**  
Same relink pattern required on mainnet **before** public claim. Wrong order (ICO pointing to old engine) would strand minted RACE on wrong engine. **NO-GO** until live `claimEnabled` probe passes on production Engine address.

**ACCEPTANCE CRITERIA:**  
- Live Engine `claimEnabled()` eth_call returns encoded bool (not `0x`).  
- ICO + Vault `engine()` addresses match `deployment.json`.  
- Hardhat claim policy tests pass on deployed bytecode class.  
- H-9 acceptance satisfied (same verification).  
- Tokenomics unchanged (no MAX_SUPPLY / allocation changes).

---

## TICKET C-2

**TICKET ID:** C-2  
**TITLE:** Virtual compound reserve → tx → receipt/event verification → finalize/refund FSM  
**SEVERITY:** CRITICAL  
**AREA:** Laravel virtual income wallet / compound API  

**CURRENT PROBLEM:**  
`VirtualIncomeCompoundService::confirmOnChain` persists `tx_hash` in metadata without verifying receipt status, sender, contract, or `RewardCompounded` / stake update. Virtual compound confirm lacks on-chain verification; virtual funds can be debited without proven mint.

**EVIDENCE:**  
- Audit **CRITICAL** C-2; HIGH H-7 duplicate (same fix).  
- `confirmOnChain` — regex-validates hash, sets `metadata.tx_hash`, `phase: confirmed_on_chain` — **no RPC**.  
- Summary: Compound **PARTIAL** / **HIGH**.

**TARGET STATE:**  
Idempotent FSM: `reserved` (debited) → `submitted` (hash pending) → `confirmed` (receipt success + `RewardCompounded` log proof) **or** `failed`/`expired` (**credited back** via `compound_refund:{idempotency_key}`).  
Scheduled `income:reconcile-pending-compounds` for TTL auto-refund.

**FILES / CONTRACTS INVOLVED:**  
- `app/Services/Income/VirtualIncomeCompoundService.php` — `reserve()`, `confirmOnChain()` (+ new verify/refund methods)  
- `app/Http/Controllers/VirtualIncomeCompoundController.php`  
- `app/Services/Income/VirtualIncomeWalletService.php`  
- `app/Services/Blockchain/BscJsonRpcClient.php`  
- On-chain: `RaceCommunityEngine.compoundReward` → `RewardCompounded` topic `0x172683bc9e168fd8e43e442d0e5392595c48b43230044dee7c406e017e52c510`  
- `config/blockchain.php` — `community_engine`  
- `tests/Feature/VirtualIncomeWalletArchitectureTest.php`

**DATABASE IMPACT:**  
- Metadata: `compound_status`, `reserved_until`, `tx_hash` (JSON sufficient per plan).  
- Optional `compound_reservations` table if metadata insufficient.  
- Unique enforcement on confirmed `metadata->tx_hash` for `TYPE_COMPOUND`.

**SMART CONTRACT IMPACT:**  
None to Solidity. Deployed Engine must match C-1 before event verification.

**BACKEND IMPACT:**  
- Implement `verifyAndFinalize` (receipt status, `from` == user wallet, engine log decode, stake_index/amount match).  
- Implement `refundReserve` with idempotency `compound_refund:{idempotency_key}`.  
- Queue worker for async verification.  
- Optional `submitTxHash` split + TTL on `reserve`.

**FRONTEND IMPACT:**  
- Compound flow: reserve → wallet tx → confirm only after server verification passes (or poll job status).  
- Error states for failed/expired refund.

**INDEXER IMPACT:**  
None required for core fix; optional cross-check `RewardCompounded` in `blockchain_events` after H-2.

**DEPENDENCIES:**  
- **After C-1** — stable `community_engine` address in config.  
- **Before** MAINNET GO for virtual compound path.  
- Closes H-7.

**IMPLEMENTATION STEPS:**  
1. Add metadata TTL on `reserve` (`reserved_until`).  
2. Implement RPC verification in `confirmOnChain` or dedicated `verifyAndFinalize`.  
3. Implement `refundReserve` credit path.  
4. Add scheduled command `income:reconcile-pending-compounds`.  
5. Wire queue for pending compounds.  
6. Add DB unique guard on tx_hash where confirmed.  
7. Update API responses for pending/failed/confirmed states.

**TESTS REQUIRED:**  
- Mock RPC: failed receipt → refund, balance restored.  
- Mock RPC: valid receipt + logs → confirmed.  
- Duplicate confirm idempotent.  
- Wrong stake index in log → reject + refund.  
- Confirm with ICO tx hash `0xd6a8025c…` → fail + refund.  
- Extend `VirtualIncomeWalletArchitectureTest.php`.

**TESTNET VERIFICATION:**  
```powershell
php artisan test --filter=VirtualIncomeCompound
```
Hybrid user: `reserve` → real `compoundReward` on testnet → confirm after verifier passes; bogus hash must fail and refund.

**ROLLBACK PLAN:**  
- Feature flag to disable confirm finalization (keep reserve only) if verifier broken.  
- Revert Laravel deploy; manual credit users affected by false confirms (ops runbook).  
- Do not change on-chain state in rollback.

**MAINNET IMPACT:**  
**CRITICAL** on mainnet launch — same verifier mandatory before GO (see MAINNET_GO_CRITERIA #5).

**ACCEPTANCE CRITERIA:**  
- Testnet exit criterion #4: failed hash → refund; valid hash → confirmed.  
- No finalize without receipt `status == 0x1` and matching `RewardCompounded`.  
- Idempotent reserve and refund keys.  
- C-2 / H-7 closed in audit register.

---

## TICKET H-1

**TICKET ID:** H-1  
**TITLE:** Withdrawal reject refund/reversal  
**SEVERITY:** HIGH  
**AREA:** Laravel withdrawals / virtual income wallet  

**CURRENT PROBLEM:**  
`WithdrawalService::reject()` sets status only; virtual gross reserved at `request()` is not credited back. Withdrawal request debits virtual wallet; **`reject()` does not credit back**.

**EVIDENCE:**  
- `WithdrawalService::request()` — virtual debit `withdrawal_request:{id}`; `creditCashOutAdminFee()`, `AffiliateTeamRewardsService::onWithdrawal()` at request.  
- `reject()` (~348–360) — `status = rejected` only.  
- Audit HIGH H-1; Withdrawal **PARTIAL** / **HIGH**; Virtual Income Wallet gap VI-1.

**TARGET STATE:**  
Single DB transaction for `reject()`: lock withdrawal → guard pending → idempotent virtual **credit** `withdrawal_reject_refund:{id}` → (Option A or B for team/admin fee reversal) → `status = rejected`.  
Must NOT credit outside transaction (double refund risk).

**FILES / CONTRACTS INVOLVED:**  
- `app/Services/Income/WithdrawalService.php` — `request()`, `reject()`, `approve()`  
- `app/Services/Income/VirtualIncomeWalletService.php`  
- `app/Services/Income/AffiliateTeamRewardsService.php`  
- `app/Services/Income/LedgerWriter.php`  
- `app/Orchid/Screens/Data/WithdrawalEditScreen.php`  
- `app/Models/IncomeWalletTransaction.php`, `Withdrawal.php`

**DATABASE IMPACT:**  
- Credits in `income_wallet_transactions` with idempotency `withdrawal_reject_refund:{id}`.  
- Optional `withdrawal_reversals` audit table **or** compensating `ledger_entries` (Option B: `withdrawal_reject_fee_reversal:{id}`).

**SMART CONTRACT IMPACT:**  
None.

**BACKEND IMPACT:**  
- Implement reject transaction boundary per remediation plan table (BEGIN … COMMIT).  
- Product decision: **Option A (recommended)** defer team reward + admin fee ledger until **approve** **or** **Option B (minimal)** compensating reversals on reject.  
- Align with M-13 (team rewards at request complicate reject).

**FRONTEND IMPACT:**  
- Withdrawal status UI: rejected shows balance restored (virtual income page refresh).

**INDEXER IMPACT:**  
None.

**DEPENDENCIES:**  
- Before testnet exit withdrawal criterion #5.  
- Parallel with C-2.  
- After M-VI-4 backfill if historical rejects exist (Phase 3).  
- H-6 tests may add `WithdrawalRejectRefundTest`.

**IMPLEMENTATION STEPS:**  
1. Document Option A vs B with product owner.  
2. Wrap `reject()` in `DB::transaction` with `lockForUpdate`.  
3. Idempotent check for existing `withdrawal_reject_refund:{id}`.  
4. `VirtualIncomeWalletService::credit` gross amount.  
5. If Option B: reverse team/admin ledger entries with separate idempotency keys.  
6. If Option A: move fee distribution from `request()` to `approve()` (larger change).  
7. Orchid reject path unchanged entrypoint, new behavior inside service.

**TESTS REQUIRED:**  
- `WithdrawalRejectRefundTest` or extend `ClaimVirtualIncomeWithdrawalPolicyTest`: request → reject → balance equals pre-request.  
- Option B: upline virtual balance reversed.  
- Idempotent double-reject.

**TESTNET VERIFICATION:**  
Manual Orchid reject after test withdrawal in staging DB copy; feature tests in CI.

**ROLLBACK PLAN:**  
- Revert `WithdrawalService` change; ops manual virtual credit for users rejected during buggy window (document user ids).

**MAINNET IMPACT:**  
Same logic required for production admin panel (MAINNET_GO_CRITERIA #12 incident runbook includes reject/refund).

**ACCEPTANCE CRITERIA:**  
- Testnet exit criterion #5: withdrawal reject restores virtual balance.  
- No virtual credit without `status = rejected` in same transaction.  
- Duplicate reject idempotent.

---

## TICKET H-2

**TICKET ID:** H-2  
**TITLE:** Indexer event topic mappings and Unknown logs  
**SEVERITY:** HIGH  
**AREA:** Blockchain indexer  

**CURRENT PROBLEM:**  
Known ICO tx `0xd6a8025c1bafcf5e627c5d632e5cf8376f834a15c15778de2da3a1e2ea4cf9f8` stores 8 rows in `blockchain_events`; **4 decoded as `Unknown`**. Indexer Unknown events (4/8 on known ICO tx).

**EVIDENCE:**  
| log_index | contract | Should be | Stored |
|-----------|----------|-----------|--------|
| 22 | engine | `MemberRegistered` (`0x3a5a00ec…`) | Unknown |
| 23 | engine | `MemberActivated` (`0xe1ff4f9b…`) | Unknown |
| 26 | ICO | `ICOPurchase` (`0x1f3dc78e…`) | Unknown |
| 28 | ICO | `UsdtTransferredToAdmin` (`0x49dfa5ea…`) | Unknown |

Stale map: `MemberRegistered` → `0x03c7da3f…`; `MemberActivated` → `0x37a30c83…` — do not match current Solidity.  
Correctly mapped in same tx: `ICOStakeCreated`, `ParticipationPurchased`, `ICOPurchased`, `RaceMintedToStaking`.

**TARGET STATE:**  
- Add topics: `ICOPurchase`, `UsdtTransferredToAdmin`.  
- Fix `MemberRegistered` / `MemberActivated` hashes to match `RaceCommunityEngine.sol`.  
- Keep duplicate aliases for legacy deployments if needed.  
- Known ICO tx: **0 Unknown** among 8 engine+ICO logs (or renamed via ops backfill).

**FILES / CONTRACTS INVOLVED:**  
- `app/Console/Commands/IndexBlockchainEventsCommand.php` — `resolveEventName()` (~267–298)  
- `contracts/src/RaceCommunityEngine.sol`, `contracts/src/RaceICO.sol` (event signatures reference)  
- Optional ops script to rename existing `Unknown` rows (not in repo yet)

**DATABASE IMPACT:**  
- Optional one-time update `blockchain_events.event_name` for known tx rows.  
- No migration required for map fix alone.  
- Idempotent re-index: no duplicate rows (`tx_hash` + `log_index` guard).

**SMART CONTRACT IMPACT:**  
None.

**BACKEND IMPACT:**  
- Update topic0 map only.  
- Unit test for `resolveEventName` on four topic0 values.

**FRONTEND IMPACT:**  
None direct; dashboards using `blockchain_events` show correct names.

**INDEXER IMPACT:**  
Primary deliverable. Optional future scope: index USDT + RaceCoin for Transfer/MinterMint (logs 19–21 — out of scope for 8 rows).

**DEPENDENCIES:**  
- Independent of C-1; complete before testnet exit indexer criterion #3.  
- Parallel H-8.

**IMPLEMENTATION STEPS:**  
1. Fix `MemberRegistered` topic to `0x3a5a00ec423040dabe80f57799a58598c7a3b374fe3bcc917901b4867b30c908` (keep legacy alias if documented).  
2. Fix `MemberActivated` to `0xe1ff4f9b8e8b5681c85fcf14e247272f9b4a3526e3207e28547d7419005bf134`.  
3. Add `ICOPurchase` → `0x1f3dc78e5383429821420268e8c7ab7fa1979caa09b4bc4f9c40d2bdf2c44c5f`.  
4. Add `UsdtTransferredToAdmin` → `0x49dfa5eafc5faed8484236c52885a8d1913aceab61263e09f37f0b915b184e26`.  
5. Run optional backfill rename for existing rows.  
6. Re-run indexer idempotency check.

**TESTS REQUIRED:**  
- Unit: `resolveEventName` for four topic0 values.  
- Integration: re-run `blockchain:index-events` — no duplicates.

**TESTNET VERIFICATION:**  
```powershell
php artisan blockchain:index-events
php scripts/verify-known-ico-tx.php
```
Expect 8 rows, 0 Unknown for tx `0xd6a8025c…`.

**ROLLBACK PLAN:**  
- Revert map changes; keep old topic aliases in map alongside new (backward compatible per plan).

**MAINNET IMPACT:**  
Same map required before production indexing (MAINNET_GO_CRITERIA #8 related).

**ACCEPTANCE CRITERIA:**  
- Testnet exit criterion #3 met.  
- Indexer **PARTIAL** → PASS for known ICO tx decoding.  
- No duplicate event rows on re-index.

---

## TICKET H-3

**TICKET ID:** H-3  
**TITLE:** Balance source reconciliation  
**SEVERITY:** HIGH  
**AREA:** Laravel virtual income wallet / ledger  

**CURRENT PROBLEM:**  
Triple balance sources without reconciliation job: `user_wallets` / `users.balance_usd`, `ledger_entries`, and `income_wallet_transactions`. Operational truth split.

**EVIDENCE:**  
- Audit HIGH H-3; Virtual Income Wallet VI-3 MEDIUM (no automated reconciliation job between `ledger_entries` and virtual table).  
- `WalletBalanceService::virtualIncomeBalance()` → `VirtualIncomeWalletService`; legacy `user_wallets` for deposits.  
- Summary table Database **PARTIAL**.

**TARGET STATE:**  
| Domain | Authoritative source |
|--------|---------------------|
| Earned income (claim/withdraw/compound) | **`income_wallet_transactions`** sum via `VirtualIncomeWalletService::availableBalance()` |
| Deposits / investment USDT wallet | **`ledger_entries`** + `user_wallets` cache |
| On-chain stake/RACE | **BSC Engine + indexer** |

Daily `php artisan income:reconcile-wallets`: flag drift > $0.01; admin read-only report — no auto-mutate without approval.  
Testnet exit #10: reconciliation dry-run **0 critical drift** for pilot users.

**FILES / CONTRACTS INVOLVED:**  
- `app/Services/Income/VirtualIncomeWalletService.php`  
- `app/Services/Income/WalletBalanceService.php`  
- `app/Services/Income/LedgerWriter.php`  
- `config/virtual_income_wallet.php` — `ledger_type_map`, `mirror_exclude`  
- New: Artisan command `income:reconcile-wallets` (planned)  
- Optional admin Orchid screen  
- Related M-1, M-2: backfill `income:backfill-virtual-wallet`

**DATABASE IMPACT:**  
- No required schema change for reconcile report.  
- Optional: deprecate display of `users.balance_usd` for income.  
- M-2 backfill for historical ledger mirror (separate medium ticket).

**SMART CONTRACT IMPACT:**  
None.

**BACKEND IMPACT:**  
- Implement reconcile command (dry-run + report).  
- Document single authority in ops runbook (extends `VIRTUAL_INCOME_WALLET_ARCHITECTURE.md`).

**FRONTEND IMPACT:**  
- Admin report UI optional; user-facing balances already use virtual service for income paths.

**INDEXER IMPACT:**  
None.

**DEPENDENCIES:**  
- After H-1 (reject refund tests in reconcile scenarios).  
- After M-VI-4 backfill if needed.  
- Before MAINNET GO finance sign-off (#9).  
- H-4 after reconciliation defined (plan order).

**IMPLEMENTATION STEPS:**  
1. Define drift formula: virtual sum vs mirrored ledger types ± exclusions from config.  
2. Implement `income:reconcile-wallets --dry-run`.  
3. Add admin read-only report.  
4. Pilot users on testnet; fix data anomalies manually (ops).  
5. Optional backfill command (M-2) before strict gate.

**TESTS REQUIRED:**  
- Feature: after claim + withdraw + reject refund, reconciliation PASS.  
- Dry-run flags injected drift in fixture.

**TESTNET VERIFICATION:**  
```powershell
php artisan income:reconcile-wallets --dry-run
```
0 critical drift for pilot users (future command).

**ROLLBACK PLAN:**  
- Disable scheduled reconcile; report-only mode off via config flag.

**MAINNET IMPACT:**  
Finance sign-off on reconciliation job required (MAINNET_GO_CRITERIA #9).

**ACCEPTANCE CRITERIA:**  
- Documented authority table matches implementation.  
- Testnet exit criterion #10.  
- Triple balance **HIGH** finding addressed for ops (M-1 closed via this ticket).

---

## TICKET H-4

**TICKET ID:** H-4  
**TITLE:** REWARDS_ENGINE mode consistency  
**SEVERITY:** HIGH  
**AREA:** Laravel config / UX  

**CURRENT PROBLEM:**  
`REWARDS_ENGINE=blockchain_only` (common in `.env`) disables Laravel ROI/claim while routes and pages for virtual income remain visible. **Mismatch UX** per audit doc vs implementation.

**EVIDENCE:**  
- `app/Support/BlockchainMode.php` — `assertReadOnlyRewards()`.  
- `phpunit.xml` — hybrid for tests only.  
- Audit HIGH H-4; Laravel virtual path **inactive** in prod env when blockchain_only.

**TARGET STATE:**  
Explicit **mode matrix** in UI and ops runbook:  
- `blockchain_only`: hide/disable Laravel claim + virtual accrual UI **or** banner “Rewards on-chain only”.  
- `hybrid`: full virtual wallet path as designed.  
One mode per environment documented.

**FILES / CONTRACTS INVOLVED:**  
- `app/Support/BlockchainMode.php`  
- `app/Console/Commands/IncomePayRoiCommand.php`, `app/Services/Income/IncomeClaimService.php`  
- Routes: `/virtual-income`, `POST /income/claim`  
- `resources/js/Pages/VirtualIncomeWallet.jsx`, `Investment.jsx`, `Withdrawal.jsx`  
- `.env.example`, `docs/VIRTUAL_INCOME_WALLET_ARCHITECTURE.md`  
- Inertia shared props / middleware

**DATABASE IMPACT:**  
None.

**SMART CONTRACT IMPACT:**  
None.

**BACKEND IMPACT:**  
- Shared prop `rewardsEngineMode`; optional `BlockchainMode::assertHybrid()` on claim routes.  
- `.env.example` comments for testnet vs production mode.

**FRONTEND IMPACT:**  
- Gates/banners on Investment, VirtualIncomeWallet, Withdrawal per mode.

**INDEXER IMPACT:**  
None.

**DEPENDENCIES:**  
- After H-3 reconciliation defined; parallel C-1; before TESTNET UAT sign-off.  
- Testnet exit criterion #9.

**IMPLEMENTATION STEPS:**  
1. Expose `rewards.engine` config to Inertia.  
2. Implement UI gates/banner for `blockchain_only`.  
3. Update `.env.example` and ops runbook.  
4. CI staging: `REWARDS_ENGINE=hybrid` for virtual UAT if needed.  
5. Manual UAT checklist for both modes.

**TESTS REQUIRED:**  
- Feature: `blockchain_only` → claim route 403 or structured error.  
- Feature: hybrid → claim succeeds with virtual credit.

**TESTNET VERIFICATION:**  
```powershell
php artisan config:show rewards.engine
```
Manual: `/virtual-income`, `/investment` — UI matches mode.

**ROLLBACK PLAN:**  
- Remove UI gates; revert to current visibility (document risk).

**MAINNET IMPACT:**  
Product must choose **single user-facing reward story** before launch (on-chain claim vs Laravel virtual).

**ACCEPTANCE CRITERIA:**  
- Testnet exit criterion #9: `REWARDS_ENGINE` mode documented and UI consistent.  
- No user-facing claim/accrual path without matching backend mode.

---

## TICKET H-5

**TICKET ID:** H-5  
**TITLE:** Legacy RaceParticipation handling  
**SEVERITY:** HIGH  
**AREA:** Config / indexer / legacy contracts  

**CURRENT PROBLEM:**  
Legacy **RaceParticipation** still deployed (`0x9BF2E3405c0cB666C6664BD7651dab3F656fEDA5`) and configurable alongside Engine. Dual participation paths — **HIGH** operational confusion.

**EVIDENCE:**  
- `deployment.json` — `raceParticipation`.  
- `IndexBlockchainEventsCommand` indexes participation address.  
- Audit HIGH H-5; legacy table risk in summary.

**TARGET STATE:**  
Participation **DEPRECATED** in config/docs. Indexer and Laravel **do not** load participation address when env blank. UI prevents participation contract calls; Engine canonical via `web3Engine.js`.

**FILES / CONTRACTS INVOLVED:**  
- `contracts/deployments/bscTestnet/deployment.json` — `raceParticipation` (reference only)  
- `config/blockchain.php` — `contracts.participation`  
- `app/Console/Commands/IndexBlockchainEventsCommand.php` — `$contracts` array  
- `contracts/src/RaceParticipation.sol` (legacy reference)  
- Frontend grep: participation contract usage

**DATABASE IMPACT:**  
None; optional `site_settings` `deprecated_participation_address`.

**SMART CONTRACT IMPACT:**  
None (no redeploy legacy unless retiring funds — out of scope).

**BACKEND IMPACT:**  
- Omit participation from indexer when `RACE_PARTICIPATION_CONTRACT` empty.  
- Document deprecated address for explorers only.

**FRONTEND IMPACT:**  
- Hard-error or redirect to Engine flows if participation targeted.

**INDEXER IMPACT:**  
- Dry-run lists only engine + ICO when participation unset.

**DEPENDENCIES:**  
- Independent; before public testnet marketing.  
- Plan order step 8.

**IMPLEMENTATION STEPS:**  
1. Clear or comment testnet `.env` participation address.  
2. Filter `$contracts` in indexer when blank.  
3. Audit frontend for participation calls; redirect to Engine.  
4. Update docs: DEPRECATED `0x9BF2…`.

**TESTS REQUIRED:**  
- Indexer dry-run lists only engine + ICO contracts when env unset.

**TESTNET VERIFICATION:**  
```powershell
php artisan blockchain:index-events --dry-run
```
No participation contract line when env unset.

**ROLLBACK PLAN:**  
- Re-enable env address for historical index replay only (ops).

**MAINNET IMPACT:**  
Mainnet `.env` never points users to Participation if Engine is canonical.

**ACCEPTANCE CRITERIA:**  
- No active product path to RaceParticipation on testnet config.  
- Indexer default scan set excludes participation when deprecated.

---

## TICKET H-6

**TICKET ID:** H-6  
**TITLE:** 6 failing PHPUnit tests  
**SEVERITY:** HIGH  
**AREA:** CI / Laravel tests  

**CURRENT PROBLEM:**  
PHPUnit **92 passed, 6 failed, 16 skipped** (audit run). Failures tied to Virtual Income Wallet balance rules and unrelated profile/id tests.

**EVIDENCE:**  
- `WithdrawalRateLimitTest` (×3) — `Insufficient Virtual Income Wallet balance` without virtual seed.  
- `BuiltForGrowthDurationTest` — ROI percent vs config.  
- `IdActivationTest` — activation null.  
- `ProfileTest` — delete account redirect/message.  
- Audit HIGH H-6.

**TARGET STATE:**  
`php artisan test` — **0 failures** (skips documented). All production-critical tests pass.

**FILES / CONTRACTS INVOLVED:**  
- `tests/Feature/WithdrawalRateLimitTest.php`  
- `tests/Feature/BuiltForGrowthDurationTest.php`  
- `tests/Feature/IdActivationTest.php`  
- `tests/Feature/ProfileTest.php`  
- Test helpers / factories for virtual income seed  
- `phpunit.xml` — hybrid mode

**DATABASE IMPACT:**  
None (test DB only).

**SMART CONTRACT IMPACT:**  
None.

**BACKEND IMPACT:**  
- Add `seedVirtualIncome(User, amount)` helper using `VirtualIncomeWalletService` or factory.  
- Update failing tests to match current config and routes.

**FRONTEND IMPACT:**  
None.

**INDEXER IMPACT:**  
None.

**DEPENDENCIES:**  
- After H-1 virtual refund tests added (optional same PR).  
- Parallel H-3.  
- Testnet exit criterion #6.

**IMPLEMENTATION STEPS:**  
1. Fix WithdrawalRateLimitTest virtual wallet funding (3 cases).  
2. Fix BuiltForGrowthDurationTest expectations vs `config/reward_plan.php`.  
3. Fix IdActivationTest and ProfileTest for current app behavior.  
4. Document skipped tests with reason.  
5. Run full suite in CI.

**TESTS REQUIRED:**  
- Full `php artisan test` green.

**TESTNET VERIFICATION:**  
```powershell
php artisan test
```

**ROLLBACK PLAN:**  
- Revert test-only changes; CI remains red until re-fixed.

**MAINNET IMPACT:**  
CI gate for any release candidate.

**ACCEPTANCE CRITERIA:**  
- Testnet exit criterion #6: 0 failures, skips documented.  
- WithdrawalRateLimitTest uses virtual income authority pattern.

---

## TICKET H-8

**TICKET ID:** H-8  
**TITLE:** Chain 56/default-mainnet safety issue  
**SEVERITY:** HIGH  
**AREA:** Laravel config / mainnet safety  

**CURRENT PROBLEM:**  
Unset `BSC_CHAIN_ID` defaults Laravel to chain **56** while testnet manifest uses **97**. **Dangerous path:** Laravel starts with `BSC_CHAIN_ID` unset → **56** — **HIGH** misconfiguration risk.

**EVIDENCE:**  
- `config/blockchain.php` — `'chain_id' => (int) env('BSC_CHAIN_ID', 56)`.  
- `IndexBlockchainEventsCommand` refuses 56 when `CONFIRM_TESTNET_DEPLOYMENT` set (partial guard).  
- Audit HIGH H-8; Mainnet Safety **PARTIAL** / **HIGH**.

**TARGET STATE:**  
- Testnet bundle: **boot fails** if testnet engine address configured and `chain_id !== 97`.  
- Mainnet bundle: fails if chain 97 with mainnet USDT address.  
- No silent default 56 on testnet hosts.  
- `.env.example`: `BSC_CHAIN_ID=97` mandatory for testnet section.

**FILES / CONTRACTS INVOLVED:**  
- `config/blockchain.php`  
- `app/Services/Blockchain/BscJsonRpcClient.php`  
- `app/Console/Commands/IndexBlockchainEventsCommand.php`  
- New: `BlockchainConfigValidator` or `AppServiceProvider::boot()`  
- `.env.example`  
- `contracts/scripts/deploy.js` (reference for testnet guards)

**DATABASE IMPACT:**  
None.

**SMART CONTRACT IMPACT:**  
None.

**BACKEND IMPACT:**  
- Fail-fast validation with clear exception listing required `.env` keys.  
- Hosting checklist update.

**FRONTEND IMPACT:**  
None direct (Inertia shared `blockchain.chain_id` should match validated config).

**INDEXER IMPACT:**  
Prevents wrong-chain indexing before cron runs.

**DEPENDENCIES:**  
- Before indexer cron on new servers; parallel H-2.  
- Testnet exit criterion #8.  
- MAINNET_GO_CRITERIA #7 (explicit 56 on mainnet with mainnet USDT).

**IMPLEMENTATION STEPS:**  
1. Implement validator matching testnet manifest addresses ↔ chain 97.  
2. Implement mainnet mismatch rules (no TestnetMockUSDT on 56 prod).  
3. Update `.env.example` and deployment checklist.  
4. Unit tests for fixture mismatches.

**TESTS REQUIRED:**  
- Unit: validator throws on testnet address + chain 56.  
- Unit: validator passes testnet `.env` fixture.

**TESTNET VERIFICATION:**  
```powershell
php artisan config:show blockchain.chain_id
php artisan blockchain:index-events --dry-run
```
Must show `97` on testnet hosts.

**ROLLBACK PLAN:**  
- Disable validator via env `BLOCKCHAIN_CONFIG_VALIDATION=false` (emergency only, documented).

**MAINNET IMPACT:**  
Mainnet must set `BSC_CHAIN_ID=56` explicitly with mainnet USDT `0x55d398326f99059fF775485246999027B3197955` — no testnet mock in `.env`.

**ACCEPTANCE CRITERIA:**  
- Testnet exit criterion #8.  
- Misconfiguration fails at boot, not at first payout/index.

---

## TICKET H-9

**TICKET ID:** H-9  
**TITLE:** On-chain claim enforcement absent on old engine (dependent on C-1)  
**SEVERITY:** HIGH  
**AREA:** Frontend on-chain claim / Engine policy  

**CURRENT PROBLEM:**  
Frontend and policy docs assume `claimEnabled` + 24h cooldown; live Engine at `0xc0D9…` does not implement selectors. On-chain claim enforcement absent on old engine (duplicate/dependent issue related to C-1).

**EVIDENCE:**  
- `web3Engine.js` `readClaimPolicyState` → `supported: false`.  
- Claims may still be attempted via raw `claimReward` if rewards accrue.  
- Audit HIGH H-9; Claim **PARTIAL** / **HIGH**; same root as C-1.  
- Summary TOP 10 #1 and #9 overlap C-1 / frontend policy not enforceable on-chain.

**TARGET STATE:**  
Same as **C-1**: policy enforced on-chain; UI shows live `claimEnabled` / `nextAllowedClaimAt` with `supported: true`.  
Verification: `claimEnabled()` eth_call non-empty on configured engine address.

**FILES / CONTRACTS INVOLVED:**  
- All **C-1** files, plus:  
- `resources/js/Pages/Isu.jsx`  
- `resources/js/Pages/RaceToken.jsx`  
- `resources/js/lib/web3Engine.js` — claim policy messages  

**DATABASE IMPACT:**  
Same as C-1 (indexer/stake read model if engine address changes).

**SMART CONTRACT IMPACT:**  
Same as C-1 — no separate Solidity work beyond C-1 redeploy/relink.

**BACKEND IMPACT:**  
None beyond C-1 config address sync.

**FRONTEND IMPACT:**  
- Enable claim policy UI when `supported: true`.  
- Show `claimPolicyMessage` with `icoCompleted`, `claimEnabled`, `canClaim`, `nextAllowedAt`.  
- Do not treat old engine as policy-enforced.

**INDEXER IMPACT:**  
Same as C-1; `ClaimEnabledUpdated` / `ClaimCooldownRecorded` once emitted.

**DEPENDENCIES:**  
- **Blocked until C-1 complete** — no separate fix.  
- Closes via C-1 verification only (remediation order step 10).

**IMPLEMENTATION STEPS:**  
1. Complete all **C-1** implementation steps.  
2. Point frontend to new engine from Inertia/config.  
3. Verify `readClaimPolicyState` returns `supported: true`, `claimEnabled` bool, cooldown fields.  
4. UAT on-chain claim with ICO complete + `setClaimEnabled(true)` + 24h cooldown.  
5. Mark H-9 closed in tracking when C-1 acceptance criteria met.

**TESTS REQUIRED:**  
- Same as C-1 Hardhat claim policy tests.  
- Manual/browser UAT on Isu/RaceToken claim buttons.

**TESTNET VERIFICATION:**  
- C-1 `claimEnabled()` eth_call non-empty.  
- UI displays policy state from chain, not static “unsupported”.

**ROLLBACK PLAN:**  
Same as C-1.

**MAINNET IMPACT:**  
Same as C-1 — Engine claim policy live with MultiSig `setClaimEnabled` runbook (MAINNET_GO_CRITERIA #4).

**ACCEPTANCE CRITERIA:**  
- H-9 closed when C-1 acceptance criteria met.  
- Testnet exit criteria #1 and #2 satisfied.  
- Claim area summary moves from **PARTIAL** to **PASS** for on-chain policy (per audit table intent).

---

# IMPLEMENTATION_ORDER

1. **C-1** — Engine redeploy + vault/ICO relink + MultiSig ownership + update manifest/env  
2. **C-2 / H-7** — Compound verify + refund job (H-7 closes with C-2; no separate ticket)  
3. **H-1 / M-13** — Withdrawal reject refund (+ fee reversal policy)  
4. **H-2** — Indexer topic map fix + optional row backfill  
5. **H-8** — Chain ID fail-fast validation  
6. **H-3 / M-1 / M-2** — Reconciliation + backfill command  
7. **H-4** — UX mode guards for `REWARDS_ENGINE`  
8. **H-5** — Deprecate Participation wiring  
9. **H-6** — PHPUnit repair  
10. **H-9** — Close via C-1 verification (`claimEnabled()` non-empty eth_call)  
11. Phase 3 MEDIUM items (see `READ_ONLY_REMEDIATION_PLAN.md`)  
12. Phase 4 LOW / INFO items  

---

# BLOCKED_UNTIL

- **C-1** — H-9, on-chain claim UAT, testnet exit criteria #1 and #2, C-2 engine address for event verification  
- **C-2** — Testnet exit criterion #4; MAINNET_GO criterion #5; virtual compound path safe for users  

---

# TESTNET_EXIT_GATE

Exact criteria from `docs/READ_ONLY_REMEDIATION_PLAN.md` § TESTNET_EXIT_CRITERIA:

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Live Engine `claimEnabled()` eth_call returns encoded bool | RPC script / Hardhat |
| 2 | ICO + Vault `engine()` addresses match manifest | `check-testnet-deployment.js` |
| 3 | Known ICO tx indexer: **0 Unknown** among 8 engine+ICO logs (or renamed) | `verify-known-ico-tx.php` |
| 4 | Virtual compound: failed hash → refund; valid hash → confirmed | Feature tests + manual tx |
| 5 | Withdrawal reject restores virtual balance | Feature test |
| 6 | `php artisan test` — 0 failures (skips documented) | CI |
| 7 | Hardhat **132** passing | `npx hardhat test` |
| 8 | `BSC_CHAIN_ID=97` enforced in testnet `.env` | `config:show` |
| 9 | `REWARDS_ENGINE` mode documented and UI consistent | Manual UAT checklist |
| 10 | Reconciliation dry-run **0 critical drift** for pilot users | Future artisan command |

**Status target:** `TESTNET_PROTOCOL_STATUS: GREEN` (from current **AMBER**).

---

# MAINNET_GO_GATE

Exact criteria from `docs/READ_ONLY_REMEDIATION_PLAN.md` § MAINNET_GO_CRITERIA:

| # | Criterion |
|---|-----------|
| 1 | All **TESTNET_EXIT_CRITERIA** met on testnet |
| 2 | **CRITICAL** count **0** open |
| 3 | **HIGH** count **0** open (or explicit signed waivers with expiry) |
| 4 | Engine claim policy live on mainnet address with MultiSig `setClaimEnabled` runbook |
| 5 | Virtual wallet compound verifier deployed with queue monitoring |
| 6 | Mainnet manifest separate from testnet; `deploy:mainnet` checklist completed |
| 7 | `BSC_CHAIN_ID=56` with **mainnet** USDT `0x55d398…` — no testnet mock addresses in `.env` |
| 8 | Indexer mainnet start block + confirmation depth policy documented |
| 9 | Finance sign-off on reconciliation job |
| 10 | External audit or internal sign-off on RaceCoin minter set (ICO + Vault only) |
| 11 | No `CONFIRM_TESTNET_DEPLOYMENT` on production |
| 12 | Incident runbook for reject/refund/compound failure |

**Status target:** `MAINNET_READINESS: GO` (from current **NO-GO**).

---

*Tickets derived from read-only remediation plan only. Tokenomics remain locked; no new business rules invented.*
