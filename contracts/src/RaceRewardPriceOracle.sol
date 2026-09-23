// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IRaceRewardPriceOracle} from "./interfaces/IRaceRewardPriceOracle.sol";

/**
 * @title RaceRewardPriceOracle
 * @notice Dedicated reward-conversion price feed for RaceCommunityEngine.
 * @dev Not Pancake getAmountsOut. Owner/updaters push price with:
 *      - zero rejection
 *      - min/max bounds
 *      - max update deviation (bps)
 *      - staleness heartbeat on read
 *
 *      RACE has no reliable public Chainlink feed in-repo; this adapter is the
 *      authoritative source for rewardUsdt → rewardRace mint sizing.
 */
contract RaceRewardPriceOracle is Ownable, IRaceRewardPriceOracle {
    uint256 public constant BPS = 10_000;
    uint256 public constant MIN_MAX_STALENESS = 1 minutes;
    uint256 public constant MAX_MAX_STALENESS = 7 days;

    /// @notice USDT (18 decimals) paid for 1 RACE (1e18).
    uint256 private _priceUsdtPerRace;
    uint64 public updatedAt;
    uint64 public maxStaleness;

    uint256 public minPriceUsdt;
    uint256 public maxPriceUsdt;
    /// @notice Max |new-old|/old in bps on each update (0 = disabled).
    uint256 public maxUpdateDeviationBps;

    mapping(address => bool) public isUpdater;

    event PriceUpdated(uint256 priceUsdtPerRace, uint64 updatedAt, address indexed updater);
    event UpdaterUpdated(address indexed account, bool allowed);
    event BoundsUpdated(uint256 minPriceUsdt, uint256 maxPriceUsdt, uint256 maxUpdateDeviationBps);
    event MaxStalenessUpdated(uint64 maxStaleness);

    error OracleZeroPrice();
    error OracleStale();
    error OracleOutOfBounds();
    error OracleDeviation();
    error OracleBadConfig();
    error OracleNotUpdater();

    constructor(
        address initialOwner,
        uint256 initialPriceUsdtPerRace,
        uint64 maxStaleness_,
        uint256 minPriceUsdt_,
        uint256 maxPriceUsdt_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "oracle: zero owner");
        if (maxStaleness_ < MIN_MAX_STALENESS || maxStaleness_ > MAX_MAX_STALENESS) revert OracleBadConfig();
        if (minPriceUsdt_ == 0 || maxPriceUsdt_ < minPriceUsdt_) revert OracleBadConfig();
        if (initialPriceUsdtPerRace < minPriceUsdt_ || initialPriceUsdtPerRace > maxPriceUsdt_) {
            revert OracleOutOfBounds();
        }

        maxStaleness = maxStaleness_;
        minPriceUsdt = minPriceUsdt_;
        maxPriceUsdt = maxPriceUsdt_;
        maxUpdateDeviationBps = 2_000; // 20% default per update
        isUpdater[initialOwner] = true;

        _priceUsdtPerRace = initialPriceUsdtPerRace;
        updatedAt = uint64(block.timestamp);
        emit PriceUpdated(initialPriceUsdtPerRace, updatedAt, initialOwner);
    }

    function setUpdater(address account, bool allowed) external onlyOwner {
        require(account != address(0), "oracle: zero updater");
        isUpdater[account] = allowed;
        emit UpdaterUpdated(account, allowed);
    }

    function setMaxStaleness(uint64 maxStaleness_) external onlyOwner {
        if (maxStaleness_ < MIN_MAX_STALENESS || maxStaleness_ > MAX_MAX_STALENESS) revert OracleBadConfig();
        maxStaleness = maxStaleness_;
        emit MaxStalenessUpdated(maxStaleness_);
    }

    function setBounds(uint256 minPriceUsdt_, uint256 maxPriceUsdt_, uint256 maxUpdateDeviationBps_)
        external
        onlyOwner
    {
        if (minPriceUsdt_ == 0 || maxPriceUsdt_ < minPriceUsdt_) revert OracleBadConfig();
        if (maxUpdateDeviationBps_ > BPS) revert OracleBadConfig();
        minPriceUsdt = minPriceUsdt_;
        maxPriceUsdt = maxPriceUsdt_;
        maxUpdateDeviationBps = maxUpdateDeviationBps_;
        emit BoundsUpdated(minPriceUsdt_, maxPriceUsdt_, maxUpdateDeviationBps_);
    }

    /// @notice Push a new RACE/USDT price (USDT per 1 RACE, 18 decimals).
    function updatePrice(uint256 newPriceUsdtPerRace) external {
        if (!isUpdater[msg.sender] && msg.sender != owner()) revert OracleNotUpdater();
        if (newPriceUsdtPerRace == 0) revert OracleZeroPrice();
        if (newPriceUsdtPerRace < minPriceUsdt || newPriceUsdtPerRace > maxPriceUsdt) {
            revert OracleOutOfBounds();
        }

        uint256 oldPrice = _priceUsdtPerRace;
        if (maxUpdateDeviationBps > 0 && oldPrice > 0) {
            uint256 diff = newPriceUsdtPerRace > oldPrice
                ? newPriceUsdtPerRace - oldPrice
                : oldPrice - newPriceUsdtPerRace;
            if ((diff * BPS) / oldPrice > maxUpdateDeviationBps) revert OracleDeviation();
        }

        _priceUsdtPerRace = newPriceUsdtPerRace;
        updatedAt = uint64(block.timestamp);
        emit PriceUpdated(newPriceUsdtPerRace, updatedAt, msg.sender);
    }

    /// @inheritdoc IRaceRewardPriceOracle
    function racePriceUsdt() external view returns (uint256 priceUsdtPerRace) {
        priceUsdtPerRace = _priceUsdtPerRace;
        if (priceUsdtPerRace == 0) revert OracleZeroPrice();
        if (block.timestamp > uint256(updatedAt) + uint256(maxStaleness)) revert OracleStale();
        if (priceUsdtPerRace < minPriceUsdt || priceUsdtPerRace > maxPriceUsdt) revert OracleOutOfBounds();
    }

    /// @notice Latest stored price without staleness check (ops / UI only).
    function rawPriceUsdtPerRace() external view returns (uint256) {
        return _priceUsdtPerRace;
    }
}
