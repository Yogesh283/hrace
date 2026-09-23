// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRaceRewardPool {
    function payLevelReward(address upline, address from, uint256 level, uint256 amount) external;
}
