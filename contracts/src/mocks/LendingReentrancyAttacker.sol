// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILendingFund {
    function fundLiquidity(uint256 amount) external;
}

/// @dev Attempt reentrancy during fundLiquidity callback (should fail).
contract LendingReentrancyAttacker {
    address public lending;
    IERC20 public usdt;
    bool internal _entered;

    constructor(address lending_, address usdt_) {
        lending = lending_;
        usdt = IERC20(usdt_);
    }

    function attack() external {
        usdt.approve(lending, type(uint256).max);
        ILendingFund(lending).fundLiquidity(1 ether);
    }

    function onERC20Received() external returns (bytes4) {
        return this.onERC20Received.selector;
    }
}
