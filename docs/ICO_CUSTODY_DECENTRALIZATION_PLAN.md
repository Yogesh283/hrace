# ICO Custody Decentralization Plan (Design)

## Current

`RaceICO.purchase` → `usdt.safeTransferFrom(buyer, adminWallet, amount)` (`RaceICO.sol`).

**Trust:** `adminWallet` EOA or multisig-controlled EOA; owner can `setAdminWallet`.

## Future (additive)

- New `RaceICOTreasuryRouter` or configure `adminWallet` = MultiSig contract address **without changing price/phases/caps**.
- USDT flows to MultiSig; withdrawals via existing 3-of-5.

## Migration

- Set `adminWallet` to MultiSig via governed tx.
- No breaking `purchase()` signature change.

**Live change:** NOT DONE in this track.
