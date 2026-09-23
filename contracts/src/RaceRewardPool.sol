// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRaceStaking} from "./interfaces/IRaceStaking.sol";
import {IRaceRewardPool} from "./interfaces/IRaceRewardPool.sol";

/**
 * @title RaceRewardPool
 * @notice 40% staking rewards pool. Daily claims accumulate up to 30 missed days.
 */
contract RaceRewardPool is Ownable, ReentrancyGuard, IRaceRewardPool {
    using SafeERC20 for IERC20;

    uint256 public constant REWARD_POOL_ALLOCATION = 20_000_000 ether;
    uint256 public constant MAX_ACCUMULATION_DAYS = 30;

    IERC20 public immutable raceToken;
    IRaceStaking public immutable staking;

    uint256 public dailyEmission = 50_000 ether;
    address public governance;

    mapping(address => uint256) public lastClaimDay;
    mapping(address => uint256) public totalLevelIncome;

    event DailyRewardClaimed(address indexed user, uint256 amount, uint256 daysClaimed, uint256 day);
    event LevelRewardPaid(address indexed upline, address indexed from, uint256 level, uint256 amount);
    event DailyEmissionUpdated(uint256 amount);
    event GovernanceUpdated(address governance);

    modifier onlyStaking() {
        require(msg.sender == address(staking), "RaceRewardPool: not staking");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance || msg.sender == owner(), "RaceRewardPool: not governance");
        _;
    }

    constructor(address initialOwner, address raceToken_, address staking_) Ownable(initialOwner) {
        require(raceToken_ != address(0), "RaceRewardPool: zero token");
        require(staking_ != address(0), "RaceRewardPool: zero staking");
        raceToken = IERC20(raceToken_);
        staking = IRaceStaking(staking_);
    }

    function setGovernance(address governance_) external onlyOwner {
        governance = governance_;
        emit GovernanceUpdated(governance_);
    }

    function setDailyEmission(uint256 amount) external onlyGovernance {
        dailyEmission = amount;
        emit DailyEmissionUpdated(amount);
    }

    function poolBalance() external view returns (uint256) {
        return raceToken.balanceOf(address(this));
    }

    function pendingDailyReward(address user) external view returns (uint256) {
        if (!staking.registered(user) || !staking.idActive(user)) {
            return 0;
        }

        uint256 userStake = staking.activeStakeAmount(user);
        if (userStake == 0) {
            return 0;
        }

        uint256 totalStake = staking.totalActiveStake();
        if (totalStake == 0) {
            return 0;
        }

        uint256 today = _today();
        uint256 last = lastClaimDay[user];
        uint256 daysOwed = last == 0 ? 1 : today - last;
        if (daysOwed == 0 || last >= today) {
            return 0;
        }
        if (daysOwed > MAX_ACCUMULATION_DAYS) {
            daysOwed = MAX_ACCUMULATION_DAYS;
        }

        uint256 perDay = (dailyEmission * userStake) / totalStake;
        return perDay * daysOwed;
    }

    /**
     * @notice Claim daily reward for all missed days (max 30-day backlog).
     */
    function claimDailyReward() external nonReentrant {
        require(staking.registered(msg.sender), "RaceRewardPool: not registered");
        require(staking.idActive(msg.sender), "RaceRewardPool: ID not active");

        uint256 userStake = staking.activeStakeAmount(msg.sender);
        require(userStake > 0, "RaceRewardPool: no stake");

        uint256 totalStake = staking.totalActiveStake();
        require(totalStake > 0, "RaceRewardPool: no total stake");

        uint256 today = _today();
        uint256 last = lastClaimDay[msg.sender];
        uint256 daysOwed = last == 0 ? 1 : today - last;
        require(daysOwed > 0 && last < today, "RaceRewardPool: already claimed");
        if (daysOwed > MAX_ACCUMULATION_DAYS) {
            daysOwed = MAX_ACCUMULATION_DAYS;
        }

        uint256 perDay = (dailyEmission * userStake) / totalStake;
        require(perDay > 0, "RaceRewardPool: zero reward");

        uint256 reward = perDay * daysOwed;
        require(raceToken.balanceOf(address(this)) >= reward, "RaceRewardPool: insufficient pool");

        lastClaimDay[msg.sender] = today;
        raceToken.safeTransfer(msg.sender, reward);
        emit DailyRewardClaimed(msg.sender, reward, daysOwed, today);
    }

    function payLevelReward(
        address upline,
        address from,
        uint256 level,
        uint256 amount
    ) external onlyStaking nonReentrant {
        require(upline != address(0), "RaceRewardPool: zero upline");
        require(amount > 0, "RaceRewardPool: zero amount");
        require(raceToken.balanceOf(address(this)) >= amount, "RaceRewardPool: insufficient pool");

        totalLevelIncome[upline] += amount;
        raceToken.safeTransfer(upline, amount);
        emit LevelRewardPaid(upline, from, level, amount);
    }

    function _today() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }
}
