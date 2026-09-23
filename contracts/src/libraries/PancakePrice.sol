// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPancakeRouter02} from "../interfaces/IPancakeRouter.sol";

/**
 * @title PancakePrice
 * @notice Live RACE/USDT price from PancakeSwap router — never use fixed or off-chain prices.
 */
library PancakePrice {
    /// @dev USDT value (18 decimals) → RACE amount (18 decimals) at current pool price.
    function usdtToRace(
        IPancakeRouter02 router,
        address usdt,
        address race,
        uint256 usdtAmount
    ) internal view returns (uint256) {
        if (usdtAmount == 0) {
            return 0;
        }
        address[] memory path = new address[](2);
        path[0] = usdt;
        path[1] = race;
        uint256[] memory amounts = router.getAmountsOut(usdtAmount, path);
        return amounts[1];
    }

    /// @dev RACE amount → USDT value at current pool price.
    function raceToUsdt(
        IPancakeRouter02 router,
        address race,
        address usdt,
        uint256 raceAmount
    ) internal view returns (uint256) {
        if (raceAmount == 0) {
            return 0;
        }
        address[] memory path = new address[](2);
        path[0] = race;
        path[1] = usdt;
        uint256[] memory amounts = router.getAmountsOut(raceAmount, path);
        return amounts[1];
    }
}
