// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRaceMintable
 * @notice Minimal mint interface for ICO + reward vault.
 */
interface IRaceMintable {
    function mint(address to, uint256 amount) external;
}
