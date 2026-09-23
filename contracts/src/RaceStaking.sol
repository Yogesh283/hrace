// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRaceStaking} from "./interfaces/IRaceStaking.sol";
import {IRaceRewardPool} from "./interfaces/IRaceRewardPool.sol";

/**
 * @title RaceStaking
 * @notice Registration (optional referral), RACE staking with lock periods, ID activation.
 * @dev Lock options: flexible (0), 30, 90, 180 days. Flexible = withdraw anytime.
 */
contract RaceStaking is Ownable, ReentrancyGuard, IRaceStaking {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    address public rewardPool;
    address public governance;

    uint256 public constant MAX_LEVELS = 10;
    /// Flexible staking — no lock; user can unstake anytime.
    uint256 public constant LOCK_FLEXIBLE = 0;
    uint256 public constant LOCK_30 = 30 days;
    uint256 public constant LOCK_90 = 90 days;
    uint256 public constant LOCK_180 = 180 days;

    mapping(address => bool) public registered;
    mapping(address => address) public referrerOf;
    mapping(address => bool) public idActive;
    mapping(address => uint256) public activeStakeAmount;

    uint256 public totalActiveStake;
    uint256 public totalStakers;

    struct StakeInfo {
        uint256 amount;
        uint256 unlockAt;
        bool flexible;
        bool withdrawn;
    }

    mapping(address => StakeInfo[]) private _stakes;

    /// Level income bps paid from reward pool on each stake (must sum <= 2000 recommended).
    uint256[MAX_LEVELS] public levelBps;

    event Registered(address indexed user, address indexed referrer);
    event Staked(address indexed user, uint256 amount, uint256 lockPeriod, uint256 unlockAt);
    event Unstaked(address indexed user, uint256 amount, uint256 stakeIndex);
    event LevelIncomePaid(address indexed upline, address indexed from, uint256 level, uint256 amount);
    event RewardPoolUpdated(address rewardPool);
    event GovernanceUpdated(address governance);

    modifier onlyGovernance() {
        require(msg.sender == governance || msg.sender == owner(), "RaceStaking: not governance");
        _;
    }

    constructor(address initialOwner, address raceToken_, address rewardPool_) Ownable(initialOwner) {
        require(raceToken_ != address(0), "RaceStaking: zero token");
        raceToken = IERC20(raceToken_);
        rewardPool = rewardPool_;

        levelBps = [500, 200, 100, 50, 50, 25, 25, 25, 25, 25];
    }

    function setGovernance(address governance_) external onlyOwner {
        governance = governance_;
        emit GovernanceUpdated(governance_);
    }

    function setRewardPool(address rewardPool_) external onlyGovernance {
        require(rewardPool_ != address(0), "RaceStaking: zero pool");
        rewardPool = rewardPool_;
        emit RewardPoolUpdated(rewardPool_);
    }

    function setLevelBps(uint256[MAX_LEVELS] calldata bps) external onlyGovernance {
        levelBps = bps;
    }

    /**
     * @param referrer Optional; address(0) allowed for no referral.
     */
    function register(address referrer) external {
        require(!registered[msg.sender], "RaceStaking: already registered");
        if (referrer != address(0)) {
            require(referrer != msg.sender, "RaceStaking: self referral");
            require(registered[referrer], "RaceStaking: invalid referrer");
        }

        registered[msg.sender] = true;
        referrerOf[msg.sender] = referrer;
        emit Registered(msg.sender, referrer);
    }

    /**
     * @param amount RACE amount (18 decimals).
     * @param lockPeriod LOCK_FLEXIBLE (0), LOCK_30, LOCK_90, or LOCK_180.
     */
    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant {
        require(registered[msg.sender], "RaceStaking: not registered");
        require(amount > 0, "RaceStaking: zero amount");
        require(_isValidLockPeriod(lockPeriod), "RaceStaking: invalid lock");

        raceToken.safeTransferFrom(msg.sender, address(this), amount);

        bool flexible = lockPeriod == LOCK_FLEXIBLE;
        uint256 unlockAt = flexible ? block.timestamp : block.timestamp + lockPeriod;
        _stakes[msg.sender].push(
            StakeInfo({amount: amount, unlockAt: unlockAt, flexible: flexible, withdrawn: false})
        );

        if (!idActive[msg.sender]) {
            idActive[msg.sender] = true;
            totalStakers += 1;
        }

        activeStakeAmount[msg.sender] += amount;
        totalActiveStake += amount;

        _payLevelIncome(msg.sender, amount);

        emit Staked(msg.sender, amount, lockPeriod, unlockAt);
    }

    function unstake(uint256 stakeIndex) external nonReentrant {
        StakeInfo storage info = _stakes[msg.sender][stakeIndex];
        require(!info.withdrawn, "RaceStaking: withdrawn");
        require(block.timestamp >= info.unlockAt, "RaceStaking: locked");

        uint256 amount = info.amount;
        info.withdrawn = true;

        activeStakeAmount[msg.sender] -= amount;
        totalActiveStake -= amount;

        if (activeStakeAmount[msg.sender] == 0) {
            idActive[msg.sender] = false;
        }

        raceToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, stakeIndex);
    }

    function stakeCount(address user) external view returns (uint256) {
        return _stakes[user].length;
    }

    function stakeAt(address user, uint256 index)
        external
        view
        returns (uint256 amount, uint256 unlockAt, bool flexible, bool withdrawn)
    {
        StakeInfo storage info = _stakes[user][index];
        return (info.amount, info.unlockAt, info.flexible, info.withdrawn);
    }

    function _isValidLockPeriod(uint256 lockPeriod) internal pure returns (bool) {
        return lockPeriod == LOCK_FLEXIBLE
            || lockPeriod == LOCK_30
            || lockPeriod == LOCK_90
            || lockPeriod == LOCK_180;
    }

    function _payLevelIncome(address user, uint256 stakeAmount) internal {
        if (rewardPool == address(0)) {
            return;
        }

        address current = referrerOf[user];
        for (uint256 level = 0; level < MAX_LEVELS && current != address(0); level++) {
            if (idActive[current]) {
                uint256 reward = (stakeAmount * levelBps[level]) / 10_000;
                if (reward > 0) {
                    IRaceRewardPool(rewardPool).payLevelReward(current, user, level + 1, reward);
                    emit LevelIncomePaid(current, user, level + 1, reward);
                }
            }
            current = referrerOf[current];
        }
    }
}
