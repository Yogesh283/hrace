// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRaceIcoStakeReceiver
 * @notice RaceICO ↔ Engine: level income on ICO hold; stake delivery on createStake.
 */
interface IRaceIcoStakeReceiver {
    /// @notice At ICO buy/hold: L1–L10 level income + $50+ activation (usdtPaid). Once per purchaseId.
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
