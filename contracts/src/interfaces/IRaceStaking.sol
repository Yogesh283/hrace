// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRaceStaking
 * @notice Minimal interface used by RaceRewardPool.
 */
interface IRaceStaking {
    function registered(address user) external view returns (bool);

    function idActive(address user) external view returns (bool);

    function activeStakeAmount(address user) external view returns (uint256);

    function totalActiveStake() external view returns (uint256);

    function referrerOf(address user) external view returns (address);
}
