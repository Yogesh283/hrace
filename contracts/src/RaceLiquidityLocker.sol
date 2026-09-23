// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RaceLiquidityLocker
 * @notice Locks PancakeSwap LP tokens until unlock time (whitepaper: 5-year liquidity lock).
 */
contract RaceLiquidityLocker is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable lpToken;
    address public immutable beneficiary;
    uint64 public immutable unlockAt;

    event Unlocked(address indexed beneficiary, uint256 amount);

    constructor(address initialOwner, address lpToken_, address beneficiary_, uint64 unlockAt_) Ownable(initialOwner) {
        require(lpToken_ != address(0), "RaceLiquidityLocker: zero lp");
        require(beneficiary_ != address(0), "RaceLiquidityLocker: zero beneficiary");
        require(unlockAt_ > block.timestamp, "RaceLiquidityLocker: past unlock");

        lpToken = IERC20(lpToken_);
        beneficiary = beneficiary_;
        unlockAt = unlockAt_;
    }

    function lockedBalance() external view returns (uint256) {
        return lpToken.balanceOf(address(this));
    }

    function unlock() external {
        require(block.timestamp >= unlockAt, "RaceLiquidityLocker: locked");
        uint256 amount = lpToken.balanceOf(address(this));
        require(amount > 0, "RaceLiquidityLocker: empty");
        lpToken.safeTransfer(beneficiary, amount);
        emit Unlocked(beneficiary, amount);
    }
}
