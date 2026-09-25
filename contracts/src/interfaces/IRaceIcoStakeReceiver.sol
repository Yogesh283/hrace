// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRaceIcoStakeReceiver
 * @notice RaceICO ↔ Engine: hold has no income; createStake pays level income then opens stake.
 */
interface IRaceIcoStakeReceiver {
    /// @notice Freeze referrer at purchase time (anti–hijack before createStake).
    function bindIcoPurchaseReferrer(address buyer, uint256 icoPurchaseId) external;

    /// @notice At ICO createStake: L1–L10 level income + $50+ activation (original usdtPaid). Once per purchaseId.
    function processIcoHold(address buyer, uint256 usdtPaid, uint256 icoPurchaseId) external;

    /// @notice After ICO end: open stake. Skips level income if processIcoHold already ran.
    function openIcoStake(
        address buyer,
        uint256 usdtPaid,
        uint256 raceAmount,
        uint256 lockPeriod,
        uint256 icoPurchaseId
    ) external returns (uint256 stakeIndex);
}
