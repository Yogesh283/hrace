// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPancakeRouter02} from "./interfaces/IPancakeRouter.sol";

/**
 * @title RaceAutoLiquidity
 * @notice Receives 1% RACE fees and adds RACE/USDT liquidity on PancakeSwap.
 * @dev Accumulates RACE until `minProcessAmount`, then swaps half to USDT and adds LP to the pair.
 */
contract RaceAutoLiquidity is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    IERC20 public immutable usdt;
    IPancakeRouter02 public immutable router;

    uint256 public minProcessAmount = 100 ether;
    uint256 public slippageBps = 300; // 3%

    event LiquidityProcessed(uint256 raceUsed, uint256 usdtUsed, uint256 liquidity);
    event MinProcessAmountUpdated(uint256 amount);
    event SlippageUpdated(uint256 bps);

    constructor(
        address initialOwner,
        address raceToken_,
        address usdt_,
        address router_
    ) Ownable(initialOwner) {
        require(raceToken_ != address(0), "AutoLiq: zero race");
        require(usdt_ != address(0), "AutoLiq: zero usdt");
        require(router_ != address(0), "AutoLiq: zero router");

        raceToken = IERC20(raceToken_);
        usdt = IERC20(usdt_);
        router = IPancakeRouter02(router_);
    }

    function setMinProcessAmount(uint256 amount) external onlyOwner {
        minProcessAmount = amount;
        emit MinProcessAmountUpdated(amount);
    }

    function setSlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 2000, "AutoLiq: slippage too high");
        slippageBps = bps;
        emit SlippageUpdated(bps);
    }

    function pendingBalance() external view returns (uint256) {
        return raceToken.balanceOf(address(this));
    }

    /**
     * @notice Anyone can trigger LP add when balance >= minProcessAmount (incentivize keepers).
     */
    function processLiquidity() external nonReentrant {
        uint256 balance = raceToken.balanceOf(address(this));
        require(balance >= minProcessAmount, "AutoLiq: below minimum");

        uint256 raceHalf = balance / 2;
        uint256 raceRemain = balance - raceHalf;

        _approveIfNeeded(raceToken, address(router), raceHalf);

        address[] memory path = new address[](2);
        path[0] = address(raceToken);
        path[1] = address(usdt);

        uint256 usdtBefore = usdt.balanceOf(address(this));
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            raceHalf,
            0,
            path,
            address(this),
            block.timestamp + 600
        );
        uint256 usdtReceived = usdt.balanceOf(address(this)) - usdtBefore;

        _approveIfNeeded(raceToken, address(router), raceRemain);
        _approveIfNeeded(usdt, address(router), usdtReceived);

        uint256 raceMin = (raceRemain * (10_000 - slippageBps)) / 10_000;
        uint256 usdtMin = (usdtReceived * (10_000 - slippageBps)) / 10_000;

        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            address(raceToken),
            address(usdt),
            raceRemain,
            usdtReceived,
            raceMin,
            usdtMin,
            owner(),
            block.timestamp + 600
        );

        emit LiquidityProcessed(amountA, amountB, liquidity);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "AutoLiq: zero to");
        IERC20(token).safeTransfer(to, amount);
    }

    function _approveIfNeeded(IERC20 token, address spender, uint256 amount) internal {
        if (token.allowance(address(this), spender) < amount) {
            token.forceApprove(spender, type(uint256).max);
        }
    }
}
