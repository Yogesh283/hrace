// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal interface for RaceMultisigFund-style treasuries (USDT deposit only).
 */
interface IRaceFundDeposit {
    function deposit(address token, uint256 amount) external;

    function usdtToken() external view returns (address);
}
