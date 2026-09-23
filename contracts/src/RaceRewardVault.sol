// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IRaceRewardVault} from "./interfaces/IRaceRewardVault.sol";
import {IRaceMintable} from "./interfaces/IRaceMintable.sol";

/**
 * @title RaceRewardVault
 * @notice Income / reward payouts: mints RACE directly to the user (no admin approve per payout).
 * @dev RaceCoin must set this vault as minter. Pre-funding vault is optional (legacy fund() kept).
 */
contract RaceRewardVault is Ownable, ReentrancyGuard, IRaceRewardVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    address public engine;

    event EngineUpdated(address indexed engine);
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
        require(engine_ != address(0), "RaceRewardVault: zero engine");
        engine = engine_;
        emit EngineUpdated(engine_);
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
     * @notice Engine-only: mint RACE to user (income). Coins go to `to`, not admin.
     */
    function pay(address to, uint256 raceAmount) external onlyEngine nonReentrant {
        require(to != address(0), "RaceRewardVault: zero recipient");
        require(raceAmount > 0, "RaceRewardVault: zero pay");

        IRaceMintable(address(raceToken)).mint(to, raceAmount);
        emit Paid(to, raceAmount);
    }
}
