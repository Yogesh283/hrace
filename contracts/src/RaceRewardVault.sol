// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IRaceRewardVault} from "./interfaces/IRaceRewardVault.sol";
import {IRaceMintable} from "./interfaces/IRaceMintable.sol";
import {IRaceIncomeHold} from "./interfaces/IRaceIncomeHold.sol";

/**
 * @title RaceRewardVault
 * @notice Income / reward payouts: mint RACE. User income goes to RaceIncomeHold, not the wallet.
 * @dev Compound still mints to Engine. RaceCoin must set this vault as minter.
 */
contract RaceRewardVault is Ownable, ReentrancyGuard, IRaceRewardVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    address public engine;
    address public incomeHold;
    bool public wiringLocked;

    event EngineUpdated(address indexed engine);
    event IncomeHoldUpdated(address indexed incomeHold);
    event WiringLocked(address indexed engine, address indexed incomeHold);
    event Funded(address indexed from, uint256 amount);
    event Paid(address indexed to, uint256 amount);

    modifier onlyEngine() {
        require(msg.sender == engine, "RaceRewardVault: not engine");
        _;
    }

    constructor(address initialOwner, address raceToken_) Ownable(initialOwner) {
        require(raceToken_ != address(0), "RaceRewardVault: zero token");
        raceToken = IERC20(raceToken_);
    }

    function setEngine(address engine_) external onlyOwner {
        require(!wiringLocked, "RaceRewardVault: wiring locked");
        require(engine_ != address(0), "RaceRewardVault: zero engine");
        engine = engine_;
        emit EngineUpdated(engine_);
    }

    function setIncomeHold(address incomeHold_) external onlyOwner {
        require(!wiringLocked, "RaceRewardVault: wiring locked");
        require(incomeHold_ != address(0), "RaceRewardVault: zero hold");
        incomeHold = incomeHold_;
        emit IncomeHoldUpdated(incomeHold_);
    }

    /// @notice Permanently freeze engine + incomeHold wiring.
    function lockWiring() external onlyOwner {
        require(engine != address(0), "RaceRewardVault: no engine");
        require(!wiringLocked, "RaceRewardVault: already locked");
        wiringLocked = true;
        emit WiringLocked(engine, incomeHold);
    }

    function fund(uint256 amount) external nonReentrant {
        require(amount > 0, "RaceRewardVault: zero fund");
        raceToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    /// @notice Informational — mint mode does not require vault balance.
    function balance() external view returns (uint256) {
        return raceToken.balanceOf(address(this));
    }

    /**
     * @notice Engine-only mint. User income → IncomeHold. Engine `to` (compound) still mints to Engine.
     */
    function pay(address to, uint256 raceAmount) external onlyEngine nonReentrant {
        require(to != address(0), "RaceRewardVault: zero recipient");
        require(raceAmount > 0, "RaceRewardVault: zero pay");

        if (incomeHold != address(0) && to != engine) {
            IRaceMintable(address(raceToken)).mint(incomeHold, raceAmount);
            IRaceIncomeHold(incomeHold).credit(to, raceAmount);
        } else {
            IRaceMintable(address(raceToken)).mint(to, raceAmount);
        }
        emit Paid(to, raceAmount);
    }
}
