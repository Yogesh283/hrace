// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRaceIncomeHold {
    function credit(address user, uint256 raceAmount) external;

    function holdOf(address user) external view returns (uint256);

    function quoteWithdraw(address user)
        external
        view
        returns (
            uint256 raceAmount,
            uint256 valueUsdt,
            uint256 feeUsdt,
            uint256 teamRace,
            uint256 netRace
        );
}
