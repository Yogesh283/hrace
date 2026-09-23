// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPancakeRouter02} from "../interfaces/IPancakeRouter.sol";

/**
 * @notice Test double: 1 USDT (1e18) = 10 RACE (1e18) fixed rate.
 */
contract MockPancakeRouter is IPancakeRouter02 {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    uint256 public rateNumerator = 10;
    uint256 public rateDenominator = 1;

    constructor(address tokenA_, address tokenB_) {
        tokenA = IERC20(tokenA_);
        tokenB = IERC20(tokenB_);
    }

    /// @notice Test-only: change spot quote to simulate manipulation.
    function setRate(uint256 numerator, uint256 denominator) external {
        require(denominator > 0, "MockRouter: denom");
        rateNumerator = numerator;
        rateDenominator = denominator;
    }

    function factory() external pure returns (address) {
        return address(0);
    }

    function WETH() external pure returns (address) {
        return address(0);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        if (path.length < 2) {
            return amounts;
        }
        if (path[0] == address(tokenA) && path[1] == address(tokenB)) {
            amounts[1] = (amountIn * rateNumerator) / rateDenominator;
        } else if (path[0] == address(tokenB) && path[1] == address(tokenA)) {
            amounts[1] = (amountIn * rateDenominator) / rateNumerator;
        }
    }

    function addLiquidity(
        address,
        address,
        uint256,
        uint256,
        uint256,
        uint256,
        address,
        uint256
    ) external pure returns (uint256, uint256, uint256) {
        return (0, 0, 0);
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external {
        require(path.length == 2, "MockRouter: path");
        uint256[] memory amounts = this.getAmountsOut(amountIn, path);
        require(amounts[1] >= amountOutMin, "MockRouter: slippage");
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).safeTransfer(to, amounts[1]);
    }
}
