// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceVesting
 * @notice Cliff + linear vesting, or fixed lock until unlock (Strategic Reserve 12mo, Dev 6mo cliff + 24mo linear).
 */
contract RaceVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;

    uint64 public immutable start;
    uint64 public immutable cliffDuration;
    uint64 public immutable vestDuration;
    uint256 public immutable totalAllocation;

    uint256 public released;

    event Released(address indexed beneficiary, uint256 amount);

    constructor(
        address initialOwner,
        address token_,
        address beneficiary_,
        uint64 start_,
        uint64 cliffDuration_,
        uint64 vestDuration_,
        uint256 allocation_
    ) Ownable(initialOwner) {
        require(token_ != address(0), "RaceVesting: zero token");
        require(beneficiary_ != address(0), "RaceVesting: zero beneficiary");
        require(allocation_ > 0, "RaceVesting: zero allocation");

        token = IERC20(token_);
        beneficiary = beneficiary_;
        start = start_;
        cliffDuration = cliffDuration_;
        vestDuration = vestDuration_;
        totalAllocation = allocation_;
    }

    function releasable() public view returns (uint256) {
        return vestedAmount() - released;
    }

    function vestedAmount() public view returns (uint256) {
        if (block.timestamp < start + cliffDuration) {
            return 0;
        }

        if (vestDuration == 0) {
            return totalAllocation;
        }

        uint256 elapsed = block.timestamp - (start + cliffDuration);
        if (elapsed >= vestDuration) {
            return totalAllocation;
        }

        return (totalAllocation * elapsed) / vestDuration;
    }

    function release() external nonReentrant {
        uint256 amount = releasable();
        require(amount > 0, "RaceVesting: nothing to release");

        released += amount;
        token.safeTransfer(beneficiary, amount);
        emit Released(beneficiary, amount);
    }

    function rescueToken(address erc20, address to, uint256 amount) external onlyOwner {
        require(erc20 != address(token), "RaceVesting: use release");
        IERC20(erc20).safeTransfer(to, amount);
    }
}
