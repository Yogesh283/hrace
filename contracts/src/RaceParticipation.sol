// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPancakeRouter02} from "./interfaces/IPancakeRouter.sol";

/**
 * @title RaceParticipation
 * @notice Decentralized Participation Program — USDT in, RACE staked, daily RACE rewards from PancakeSwap price.
 * @dev Second income module. No Community Placement gate.
 *      Admin cannot withdraw user stakes, unlock early, or modify per-user rewards.
 */
contract RaceParticipation is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    IERC20 public immutable raceToken;
    IPancakeRouter02 public immutable pancakeRouter;

    uint256 public constant MIN_PARTICIPATION_USDT = 50 ether;
    uint256 public constant LOCK_FLEXIBLE = 0;
    uint256 public constant LOCK_180 = 180 days;
    uint256 public constant LOCK_365 = 365 days;
    uint256 public constant LOCK_730 = 730 days;
    uint256 public constant LOCK_1095 = 1095 days;

    uint256 public constant RATE_FLEXIBLE_BPS = 35; // FINAL: 0.35% daily (aligned with CommunityEngine)
    uint256 public constant RATE_180_BPS = 50;
    uint256 public constant RATE_365_BPS = 70;
    uint256 public constant RATE_730_BPS = 90;
    uint256 public constant RATE_1095_BPS = 100;

    uint256 public constant MAX_REWARD_DAYS = 30;
    uint256 public constant SLIPPAGE_BPS = 200;
    /// @notice 10% fee on staking principal withdraw (all lock tiers).
    uint256 public constant WITHDRAWAL_FEE_BPS = 1000;

    uint256 public totalLockedRace;
    uint256 public totalStakesCreated;

    struct StakeInfo {
        uint256 principalUsdt;
        uint256 stakedRace;
        uint256 lockPeriod;
        uint256 startedAt;
        uint256 unlockAt;
        uint256 lastRewardAt;
        uint256 dailyRateBps;
        bool withdrawn;
    }

    mapping(address => StakeInfo[]) private _stakes;

    event ParticipationPurchased(
        address indexed user,
        uint256 stakeIndex,
        uint256 usdtPaid,
        uint256 raceStaked,
        uint256 lockPeriod,
        uint256 dailyRateBps
    );
    event StakeCreated(
        address indexed user,
        uint256 stakeIndex,
        uint256 principalUsdt,
        uint256 stakedRace,
        uint256 lockPeriod,
        uint256 unlockAt
    );
    event RewardPaid(
        address indexed user,
        uint256 stakeIndex,
        uint256 rewardUsdt,
        uint256 rewardRace,
        uint256 daysPaid,
        uint256 racePriceUsdt
    );
    event RewardClaimed(address indexed user, uint256 stakeIndex, uint256 rewardRace);
    event StakeWithdrawn(address indexed user, uint256 stakeIndex, uint256 raceReturned, uint256 feeRace);

    constructor(
        address initialOwner,
        address usdt_,
        address raceToken_,
        address pancakeRouter_
    ) Ownable(initialOwner) {
        require(usdt_ != address(0) && raceToken_ != address(0) && pancakeRouter_ != address(0), "zero address");
        usdt = IERC20(usdt_);
        raceToken = IERC20(raceToken_);
        pancakeRouter = IPancakeRouter02(pancakeRouter_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Fund RACE reward vault (not user principal). Anyone may fund rewards.
     */
    function fundRewardVault(uint256 amount) external nonReentrant {
        require(amount > 0, "RaceParticipation: zero fund");
        raceToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function rewardVaultBalance() public view returns (uint256) {
        uint256 balance = raceToken.balanceOf(address(this));
        return balance > totalLockedRace ? balance - totalLockedRace : 0;
    }

    function stakeCount(address user) external view returns (uint256) {
        return _stakes[user].length;
    }

    function stakeAt(address user, uint256 index)
        external
        view
        returns (
            uint256 principalUsdt,
            uint256 stakedRace,
            uint256 lockPeriod,
            uint256 startedAt,
            uint256 unlockAt,
            uint256 lastRewardAt,
            uint256 dailyRateBps,
            bool withdrawn
        )
    {
        StakeInfo storage s = _stakes[user][index];
        return (
            s.principalUsdt,
            s.stakedRace,
            s.lockPeriod,
            s.startedAt,
            s.unlockAt,
            s.lastRewardAt,
            s.dailyRateBps,
            s.withdrawn
        );
    }

    function pendingRewardUsdt(address user, uint256 stakeIndex) external view returns (uint256) {
        StakeInfo storage s = _stakes[user][stakeIndex];
        if (s.withdrawn || s.stakedRace == 0) {
            return 0;
        }
        uint256 daysOwed = _daysOwed(s);
        return (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
    }

    function pendingRewardRace(address user, uint256 stakeIndex) external view returns (uint256) {
        uint256 rewardUsdt = this.pendingRewardUsdt(user, stakeIndex);
        if (rewardUsdt == 0) {
            return 0;
        }
        uint256 price = _racePriceUsdtPerToken();
        if (price == 0) {
            return 0;
        }
        return (rewardUsdt * 1e18) / price;
    }

    /**
     * @param usdtAmount Minimum 50 USDT (18 decimals on BSC).
     * @param lockPeriod LOCK_FLEXIBLE, LOCK_180, LOCK_365, LOCK_730, or LOCK_1095.
     */
    function participate(uint256 usdtAmount, uint256 lockPeriod) external nonReentrant whenNotPaused {
        require(usdtAmount >= MIN_PARTICIPATION_USDT, "RaceParticipation: below minimum");

        uint256 dailyRateBps = _dailyRateBps(lockPeriod);
        require(dailyRateBps > 0, "RaceParticipation: invalid lock");

        usdt.safeTransferFrom(msg.sender, address(this), usdtAmount);

        uint256 raceReceived = _swapUsdtToRace(usdtAmount);
        require(raceReceived > 0, "RaceParticipation: swap failed");

        uint256 unlockAt = block.timestamp + lockPeriod;
        uint256 stakeIndex = _stakes[msg.sender].length;

        _stakes[msg.sender].push(
            StakeInfo({
                principalUsdt: usdtAmount,
                stakedRace: raceReceived,
                lockPeriod: lockPeriod,
                startedAt: block.timestamp,
                unlockAt: unlockAt,
                lastRewardAt: block.timestamp,
                dailyRateBps: dailyRateBps,
                withdrawn: false
            })
        );

        totalLockedRace += raceReceived;
        totalStakesCreated += 1;

        emit ParticipationPurchased(msg.sender, stakeIndex, usdtAmount, raceReceived, lockPeriod, dailyRateBps);
        emit StakeCreated(msg.sender, stakeIndex, usdtAmount, raceReceived, lockPeriod, unlockAt);
    }

    /**
     * @notice Claim accrued daily rewards — paid in RACE at live PancakeSwap price. No admin approval.
     */
    function claimReward(uint256 stakeIndex) external nonReentrant whenNotPaused {
        _claimReward(msg.sender, stakeIndex);
    }

    /**
     * @notice Permissionless reward distribution (keeper or user wallet).
     */
    function distributeReward(address user, uint256 stakeIndex) external nonReentrant whenNotPaused {
        require(msg.sender == user, "RaceParticipation: not user");
        _claimReward(user, stakeIndex);
    }

    /**
     * @notice Withdraw staked RACE principal after lock (Flexible: anytime). 10% fee on all tiers.
     */
    function withdrawStake(uint256 stakeIndex) external nonReentrant whenNotPaused {
        StakeInfo storage s = _stakes[msg.sender][stakeIndex];
        require(!s.withdrawn, "RaceParticipation: withdrawn");
        require(block.timestamp >= s.unlockAt, "RaceParticipation: locked");

        uint256 amount = s.stakedRace;
        require(amount > 0, "RaceParticipation: empty stake");

        uint256 feeRace = (amount * WITHDRAWAL_FEE_BPS) / 10_000;
        uint256 netRace = amount - feeRace;

        s.withdrawn = true;
        totalLockedRace -= amount;

        raceToken.safeTransfer(msg.sender, netRace);
        emit StakeWithdrawn(msg.sender, stakeIndex, netRace, feeRace);
    }

    function _claimReward(address user, uint256 stakeIndex) internal {
        StakeInfo storage s = _stakes[user][stakeIndex];
        require(!s.withdrawn, "RaceParticipation: withdrawn");
        require(s.stakedRace > 0, "RaceParticipation: empty stake");

        uint256 daysOwed = _daysOwed(s);
        if (daysOwed == 0) {
            return;
        }

        uint256 rewardUsdt = (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
        require(rewardUsdt > 0, "RaceParticipation: zero reward");

        uint256 price = _racePriceUsdtPerToken();
        require(price > 0, "RaceParticipation: no price");

        uint256 rewardRace = (rewardUsdt * 1e18) / price;
        require(rewardRace > 0, "RaceParticipation: zero race");
        require(rewardVaultBalance() >= rewardRace, "RaceParticipation: insufficient reward vault");

        s.lastRewardAt += daysOwed * 1 days;

        raceToken.safeTransfer(user, rewardRace);

        emit RewardPaid(user, stakeIndex, rewardUsdt, rewardRace, daysOwed, price);
        emit RewardClaimed(user, stakeIndex, rewardRace);
    }

    function _daysOwed(StakeInfo storage s) internal view returns (uint256) {
        if (block.timestamp <= s.lastRewardAt) {
            return 0;
        }
        uint256 elapsed = block.timestamp - s.lastRewardAt;
        uint256 daysOwed = elapsed / 1 days;
        if (daysOwed > MAX_REWARD_DAYS) {
            daysOwed = MAX_REWARD_DAYS;
        }
        return daysOwed;
    }

    function _swapUsdtToRace(uint256 usdtAmount) internal returns (uint256 raceReceived) {
        uint256 balanceBefore = raceToken.balanceOf(address(this));

        usdt.forceApprove(address(pancakeRouter), usdtAmount);

        address[] memory path = new address[](2);
        path[0] = address(usdt);
        path[1] = address(raceToken);

        uint256[] memory quoted = pancakeRouter.getAmountsOut(usdtAmount, path);
        uint256 minOut = (quoted[1] * (10_000 - SLIPPAGE_BPS)) / 10_000;

        pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            usdtAmount,
            minOut,
            path,
            address(this),
            block.timestamp + 600
        );

        raceReceived = raceToken.balanceOf(address(this)) - balanceBefore;
    }

    function _racePriceUsdtPerToken() internal view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(raceToken);
        path[1] = address(usdt);
        uint256[] memory amounts = pancakeRouter.getAmountsOut(1e18, path);
        return amounts[1];
    }

    function _dailyRateBps(uint256 lockPeriod) internal pure returns (uint256) {
        if (lockPeriod == LOCK_FLEXIBLE) return RATE_FLEXIBLE_BPS;
        if (lockPeriod == LOCK_180) return RATE_180_BPS;
        if (lockPeriod == LOCK_365) return RATE_365_BPS;
        if (lockPeriod == LOCK_730) return RATE_730_BPS;
        if (lockPeriod == LOCK_1095) return RATE_1095_BPS;
        return 0;
    }
}
