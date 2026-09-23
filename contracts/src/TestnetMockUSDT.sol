// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestnetMockUSDT
 * @notice TESTNET ONLY — NOT real USDT / NOT Tether.
 * @dev Deploy only on BSC Testnet (chainId 97). Forbidden on BSC Mainnet (56).
 *      Decimals = 18 to match this project's RaceICO / Engine assumptions in tests.
 *      Mint is restricted to the designated Testnet faucet/admin (owner).
 */
contract TestnetMockUSDT is ERC20, Ownable {
    uint8 private constant DECIMALS = 18;

    error MainnetForbidden();

    constructor(address faucetAdmin) ERC20("RACE Test USDT", "TEST-USDT") Ownable(faucetAdmin) {
        require(faucetAdmin != address(0), "TestnetMockUSDT: zero admin");
        // Defense-in-depth: refuse construction if somehow run on mainnet fork with chainid 56.
        if (block.chainid == 56) revert MainnetForbidden();
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Mint TEST-USDT to `to`. Only faucet/admin (owner). TESTNET ONLY.
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "TestnetMockUSDT: zero to");
        require(amount > 0, "TestnetMockUSDT: zero amount");
        if (block.chainid == 56) revert MainnetForbidden();
        _mint(to, amount);
    }
}
