// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRaceTeamRewardFromHold {
    /// @notice Split already-held RACE team fee to L1–L10 (credit only, no token pull).
    function distributeIncomeHoldTeamRewards(address withdrawer, uint256 feeRace) external returns (uint256 paid);
}
