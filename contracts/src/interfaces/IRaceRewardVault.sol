// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRaceRewardVault {
    function pay(address to, uint256 raceAmount) external;

    function balance() external view returns (uint256);
}
