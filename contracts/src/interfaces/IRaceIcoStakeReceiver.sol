// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRaceIcoStakeReceiver
 * @notice RaceICO calls this after minting ICO RACE to the staking engine (atomic).
 */
interface IRaceIcoStakeReceiver {
    function openIcoStake(
        address buyer,
        uint256 usdtPaid,
        uint256 raceAmount,
        uint256 lockPeriod,
        uint256 icoPurchaseId
    ) external returns (uint256 stakeIndex);
}
