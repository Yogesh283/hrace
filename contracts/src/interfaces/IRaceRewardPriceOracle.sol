// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRaceRewardPriceOracle
 * @notice Authoritative RACE/USDT price for stake reward mint conversion (claim/compound/withdraw settle).
 * @dev Price = USDT amount (18 decimals) per 1 RACE (1e18 wei). NOT a Pancake spot quote.
 */
interface IRaceRewardPriceOracle {
    /// @notice USDT (18 decimals) per 1e18 RACE. Reverts if zero/stale/out-of-bounds.
    function racePriceUsdt() external view returns (uint256 priceUsdtPerRace);

    function updatedAt() external view returns (uint64);

    function maxStaleness() external view returns (uint64);
}
