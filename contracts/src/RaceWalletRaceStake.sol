// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IPancakeRouter02} from "./interfaces/IPancakeRouter.sol";
import {IRaceRewardVault} from "./interfaces/IRaceRewardVault.sol";
import {IRaceIcoCompletion} from "./interfaces/IRaceIcoCompletion.sol";
import {PancakePrice} from "./libraries/PancakePrice.sol";

/**
 * @title RaceWalletRaceStake
 * @notice Non-proxy wallet BEP-20 RACE staking with timed locks and daily rewards.
 * @dev Daily claim pays via RaceRewardVault. Vault must authorize this contract as a payer.
 */
contract RaceWalletRaceStake is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    IERC20 public immutable raceToken;
    IPancakeRouter02 public immutable pancakeRouter;
    IRaceRewardVault public immutable rewardVault;

    address public icoContract;
    bool public icoContractLocked;

    address public maturityTreasury;
    bool public maturityTreasuryLocked;

    uint256 public constant EMI_BPS = 3000;
    uint256 public constant EMI_INTERVAL = 30 days;

    uint256 public constant LOCK_FLEXIBLE = 0;
    uint256 public constant LOCK_180 = 180 days;
    uint256 public constant LOCK_365 = 365 days;
    uint256 public constant LOCK_730 = 730 days;
    uint256 public constant LOCK_1095 = 1095 days;

    /// @notice Min stake notional in USDT (18 decimals).
    uint256 public minParticipationUsdt = 1 ether;
    /// @notice Exit / maturity fee in bps (1000 = 10%).
    uint256 public withdrawalFeeBps = 1000;
    /// @notice Max whole days settled per daily claim.
    uint256 public maxRewardDays = 30;
    /// @notice Global claim cooldown per wallet in seconds.
    uint256 public claimCooldown = 24 hours;

    /// @notice Daily reward rate in bps for each lock (bps / 100 = %).
    uint256 public dailyRateFlexibleBps = 35; // 0.35%
    uint256 public dailyRate180Bps = 50; // 0.50%
    uint256 public dailyRate365Bps = 70; // 0.70%
    uint256 public dailyRate730Bps = 90; // 0.90%
    uint256 public dailyRate1095Bps = 100; // 1.00%

    /// @notice Expected inbound RACE transfer tax in bps (400 = 4%).
    /// @dev Stake always locks actual balance received (fee-on-transfer safe).
    uint256 public transferTaxBps = 400;
    /// @notice When true, stakeRace requires received >= expectedNetRace(gross).
    bool public enforceTransferTax;

    bool public claimEnabled;
    mapping(address => uint256) public lastSuccessfulClaimAt;

    uint256 public totalLockedRace;
    uint256 public totalStakesCreated;
    uint256 public totalEmiEscrowRace;

    struct StakeInfo {
        uint256 principalUsdt;
        uint256 stakedRace;
        uint256 lockPeriod;
        uint256 startedAt;
        uint256 unlockAt;
        uint256 lastRewardAt;
        uint256 dailyRateBps;
        uint256 rewardPriceUsdt;
        bool withdrawn;
    }

    struct MaturityEmiInfo {
        bool matured;
        bool closed;
        uint64 maturityAt;
        uint256 principalRace;
        uint256 feeRace;
        uint256 emiPoolRace;
        uint256 emi1Race;
        uint256 emi2Race;
        uint256 emi3Race;
        bool claimed1;
        bool claimed2;
        bool claimed3;
    }

    mapping(address => StakeInfo[]) private _stakes;
    mapping(address => mapping(uint256 => MaturityEmiInfo)) private _maturityEmis;

    event ClaimEnabledUpdated(bool enabled);
    event IcoContractUpdated(address indexed icoContract);
    event IcoContractLocked(address indexed icoContract);
    event MaturityTreasuryUpdated(address indexed treasury);
    event MaturityTreasuryLocked(address indexed treasury);
    event DailyRatesUpdated(
        uint256 flexibleBps,
        uint256 lock180Bps,
        uint256 lock365Bps,
        uint256 lock730Bps,
        uint256 lock1095Bps
    );
    event TransferTaxBpsUpdated(uint256 bps);
    event EnforceTransferTaxUpdated(bool enforced);
    event MinParticipationUsdtUpdated(uint256 amount);
    event WithdrawalFeeBpsUpdated(uint256 bps);
    event ClaimCooldownUpdated(uint256 seconds_);
    event MaxRewardDaysUpdated(uint256 days_);
    event StakeOpened(
        address indexed user,
        uint256 indexed stakeIndex,
        uint256 principalUsdt,
        uint256 raceStaked,
        uint256 lockPeriod,
        uint256 dailyRateBps
    );
    event RewardPaid(
        address indexed user,
        uint256 stakeIndex,
        uint256 rewardUsdt,
        uint256 rewardRace,
        uint256 daysPaid,
        uint256 racePriceUsdt
    );
    event ClaimCooldownRecorded(address indexed user, uint256 nextAllowedClaimAt);
    event StakeWithdrawn(address indexed user, uint256 stakeIndex, uint256 raceReturned, uint256 feeRace);
    event StakeCompleted(address indexed user, uint256 indexed stakeIndex, uint256 raceReturned, uint256 feeRace);
    event StakeMatured(
        address indexed user,
        uint256 indexed stakeIndex,
        uint256 principalRace,
        uint256 feeRace,
        uint256 emiPoolRace,
        uint64 maturityAt
    );
    event MaturityFeePaid(address indexed user, uint256 indexed stakeIndex, address indexed treasury, uint256 feeRace);
    event EmiScheduleCreated(
        address indexed user,
        uint256 indexed stakeIndex,
        uint256 emi1,
        uint256 emi2,
        uint256 emi3,
        uint64 due1,
        uint64 due2,
        uint64 due3
    );
    event EmiClaimed(
        address indexed user,
        uint256 indexed stakeIndex,
        uint256 emiNumber,
        uint256 amount,
        uint256 dueAt
    );
    event AdminReleaseExecuted(address indexed user, uint256 indexed stakeIndex, address indexed caller);

    constructor(
        address initialOwner,
        address usdt_,
        address raceToken_,
        address pancakeRouter_,
        address rewardVault_
    ) Ownable(initialOwner) {
        require(initialOwner != address(0), "wrs: zero owner");
        require(usdt_ != address(0) && raceToken_ != address(0) && pancakeRouter_ != address(0), "wrs: zero");
        require(rewardVault_ != address(0), "wrs: zero vault");
        usdt = IERC20(usdt_);
        raceToken = IERC20(raceToken_);
        pancakeRouter = IPancakeRouter02(pancakeRouter_);
        rewardVault = IRaceRewardVault(rewardVault_);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function setDailyRates(
        uint256 flexibleBps,
        uint256 lock180Bps,
        uint256 lock365Bps,
        uint256 lock730Bps,
        uint256 lock1095Bps
    ) external onlyOwner {
        dailyRateFlexibleBps = flexibleBps;
        dailyRate180Bps = lock180Bps;
        dailyRate365Bps = lock365Bps;
        dailyRate730Bps = lock730Bps;
        dailyRate1095Bps = lock1095Bps;
        emit DailyRatesUpdated(flexibleBps, lock180Bps, lock365Bps, lock730Bps, lock1095Bps);
    }

    function setTransferTaxBps(uint256 bps) external onlyOwner {
        transferTaxBps = bps;
        emit TransferTaxBpsUpdated(bps);
    }

    function setEnforceTransferTax(bool enforced) external onlyOwner {
        enforceTransferTax = enforced;
        emit EnforceTransferTaxUpdated(enforced);
    }

    function setMinParticipationUsdt(uint256 amount) external onlyOwner {
        require(amount > 0, "wrs: zero min");
        minParticipationUsdt = amount;
        emit MinParticipationUsdtUpdated(amount);
    }

    function setWithdrawalFeeBps(uint256 bps) external onlyOwner {
        require(bps < 10_000, "wrs: fee >=100%");
        withdrawalFeeBps = bps;
        emit WithdrawalFeeBpsUpdated(bps);
    }

    function setClaimCooldown(uint256 seconds_) external onlyOwner {
        claimCooldown = seconds_;
        emit ClaimCooldownUpdated(seconds_);
    }

    function setMaxRewardDays(uint256 days_) external onlyOwner {
        require(days_ > 0, "wrs: zero days");
        maxRewardDays = days_;
        emit MaxRewardDaysUpdated(days_);
    }

    function setClaimEnabled(bool enabled) external onlyOwner {
        claimEnabled = enabled;
        emit ClaimEnabledUpdated(enabled);
    }

    function setIcoContract(address icoContract_) external onlyOwner {
        require(!icoContractLocked, "wrs: ico locked");
        icoContract = icoContract_;
        emit IcoContractUpdated(icoContract_);
    }

    function lockIcoContract() external onlyOwner {
        require(icoContract != address(0), "wrs: no ico");
        require(!icoContractLocked, "wrs: already locked");
        icoContractLocked = true;
        emit IcoContractLocked(icoContract);
    }

    function setMaturityTreasury(address treasury_) external onlyOwner {
        require(!maturityTreasuryLocked, "wrs: treasury locked");
        require(treasury_ != address(0), "wrs: zero treasury");
        maturityTreasury = treasury_;
        emit MaturityTreasuryUpdated(treasury_);
    }

    function lockMaturityTreasury() external onlyOwner {
        require(maturityTreasury != address(0), "wrs: no treasury");
        require(!maturityTreasuryLocked, "wrs: already locked");
        maturityTreasuryLocked = true;
        emit MaturityTreasuryLocked(maturityTreasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Stake ──────────────────────────────────────────────────────────────

    function stakeRace(uint256 raceAmount, uint256 lockPeriod) external nonReentrant whenNotPaused {
        require(raceAmount > 0, "wrs: zero race");

        uint256 dailyRateBps = _dailyRateBps(lockPeriod);
        require(dailyRateBps > 0, "wrs: invalid lock");
        if (lockPeriod == LOCK_FLEXIBLE) {
            require(_isIcoCompletedForFlexible(), "wrs: flexible after ico only");
        }

        uint256 price = _livePancakeRacePriceUsdt();
        require(price > 0, "wrs: no pancake price");

        uint256 balBefore = raceToken.balanceOf(address(this));
        raceToken.safeTransferFrom(msg.sender, address(this), raceAmount);
        uint256 raceReceived = raceToken.balanceOf(address(this)) - balBefore;
        require(raceReceived > 0, "wrs: zero received");

        if (enforceTransferTax) {
            uint256 minNet = expectedNetRace(raceAmount);
            require(raceReceived >= minNet, "wrs: below tax net");
        }

        // Always stake actual received (after any on-chain transfer tax).
        uint256 principalUsdt = (raceReceived * price) / 1 ether;
        require(principalUsdt >= minParticipationUsdt, "wrs: below minimum");

        uint256 unlockAt = block.timestamp + lockPeriod;
        uint256 stakeIndex = _stakes[msg.sender].length;

        _stakes[msg.sender].push(
            StakeInfo({
                principalUsdt: principalUsdt,
                stakedRace: raceReceived,
                lockPeriod: lockPeriod,
                startedAt: block.timestamp,
                unlockAt: unlockAt,
                lastRewardAt: block.timestamp,
                dailyRateBps: dailyRateBps,
                rewardPriceUsdt: price,
                withdrawn: false
            })
        );

        totalLockedRace += raceReceived;
        totalStakesCreated += 1;

        emit StakeOpened(msg.sender, stakeIndex, principalUsdt, raceReceived, lockPeriod, dailyRateBps);
    }

    function claimReward(uint256 stakeIndex) external nonReentrant whenNotPaused {
        _claimReward(msg.sender, stakeIndex);
    }

    function withdrawStake(uint256 stakeIndex) external nonReentrant whenNotPaused {
        _withdrawStake(msg.sender, stakeIndex);
    }

    function matureStake(uint256 stakeIndex) external nonReentrant whenNotPaused {
        _matureStake(msg.sender, stakeIndex);
    }

    function claimMaturityEmi(uint256 stakeIndex, uint256 emiNumber) external nonReentrant whenNotPaused {
        _claimMaturityEmi(msg.sender, stakeIndex, emiNumber);
    }

    /// @notice Owner: after lock ends, release principal path for a user who did not exit.
    /// @dev Flexible → withdraw to user. Timed → open EMI maturity (same rules as user matureStake).
    function adminReleaseStake(address user, uint256 stakeIndex) external onlyOwner nonReentrant whenNotPaused {
        require(user != address(0), "wrs: zero user");
        StakeInfo storage s = _stakes[user][stakeIndex];
        require(!s.withdrawn, "wrs: withdrawn");
        require(block.timestamp >= s.unlockAt, "wrs: locked");

        if (s.lockPeriod == LOCK_FLEXIBLE) {
            _withdrawStake(user, stakeIndex);
        } else {
            MaturityEmiInfo storage emi = _maturityEmis[user][stakeIndex];
            require(!emi.matured, "wrs: already matured");
            _matureStake(user, stakeIndex);
        }
        emit AdminReleaseExecuted(user, stakeIndex, msg.sender);
    }

    /// @notice Owner: after an EMI due date, pay that EMI to the user if unclaimed.
    function adminClaimMaturityEmi(address user, uint256 stakeIndex, uint256 emiNumber)
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        require(user != address(0), "wrs: zero user");
        _claimMaturityEmi(user, stakeIndex, emiNumber);
        emit AdminReleaseExecuted(user, stakeIndex, msg.sender);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

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
            bool withdrawn,
            uint256 rewardPriceUsdt
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
            s.withdrawn,
            s.rewardPriceUsdt
        );
    }

    function pendingRewardUsdt(address user, uint256 stakeIndex) external view returns (uint256) {
        StakeInfo storage s = _stakes[user][stakeIndex];
        if (s.withdrawn || s.stakedRace == 0 || _maturityEmis[user][stakeIndex].matured) return 0;
        if (s.dailyRateBps == 0) return 0;
        uint256 daysOwed = _daysOwed(s);
        return (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
    }

    function pendingRewardRace(address user, uint256 stakeIndex) external view returns (uint256) {
        StakeInfo storage s = _stakes[user][stakeIndex];
        if (s.withdrawn || s.stakedRace == 0 || _maturityEmis[user][stakeIndex].matured) return 0;
        if (s.dailyRateBps == 0 || s.rewardPriceUsdt == 0) return 0;
        uint256 daysOwed = _daysOwed(s);
        uint256 rewardUsdt = (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
        if (rewardUsdt == 0) return 0;
        return (rewardUsdt * 1e18) / s.rewardPriceUsdt;
    }

    function nextAllowedClaimAt(address user) external view returns (uint256) {
        uint256 last = lastSuccessfulClaimAt[user];
        if (last == 0) return 0;
        return last + claimCooldown;
    }

    function canClaimRewards(address user) external view returns (bool) {
        if (!claimEnabled) return false;
        if (icoContract != address(0) && !IRaceIcoCompletion(icoContract).icoCompleted()) return false;
        uint256 last = lastSuccessfulClaimAt[user];
        if (last != 0 && block.timestamp < last + claimCooldown) return false;
        return true;
    }

    function livePancakeRacePriceUsdt() external view returns (uint256) {
        return _livePancakeRacePriceUsdt();
    }

    function dailyRates()
        external
        view
        returns (uint256 flexibleBps, uint256 lock180Bps, uint256 lock365Bps, uint256 lock730Bps, uint256 lock1095Bps)
    {
        return (dailyRateFlexibleBps, dailyRate180Bps, dailyRate365Bps, dailyRate730Bps, dailyRate1095Bps);
    }

    /// @notice Expected RACE after transferTaxBps (preview / enforce).
    function expectedNetRace(uint256 gross) public view returns (uint256) {
        if (gross == 0) return 0;
        if (transferTaxBps >= 10_000) return 0;
        return gross - (gross * transferTaxBps) / 10_000;
    }

    /// @notice Gross send amount to target approx `net` after transferTaxBps (ceil).
    function grossForDesiredNet(uint256 net) external view returns (uint256) {
        if (net == 0) return 0;
        require(transferTaxBps < 10_000, "wrs: tax 100%");
        uint256 denom = 10_000 - transferTaxBps;
        return (net * 10_000 + denom - 1) / denom;
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    function _withdrawStake(address user, uint256 stakeIndex) internal {
        StakeInfo storage s = _stakes[user][stakeIndex];
        require(!s.withdrawn, "wrs: withdrawn");
        require(!_maturityEmis[user][stakeIndex].matured, "wrs: matured");
        require(s.lockPeriod == LOCK_FLEXIBLE, "wrs: use matureStake");
        require(block.timestamp >= s.unlockAt, "wrs: locked");
        require(maturityTreasury != address(0), "wrs: no treasury");

        uint256 amount = s.stakedRace;
        require(amount > 0, "wrs: empty stake");

        _settleAccruedReward(user, stakeIndex, true);

        s.withdrawn = true;
        totalLockedRace -= amount;

        uint256 feeRace = (amount * withdrawalFeeBps) / 10_000;
        uint256 netRace = amount - feeRace;

        if (feeRace > 0) {
            raceToken.safeTransfer(maturityTreasury, feeRace);
            emit MaturityFeePaid(user, stakeIndex, maturityTreasury, feeRace);
        }

        raceToken.safeTransfer(user, netRace);
        emit StakeWithdrawn(user, stakeIndex, netRace, feeRace);
        emit StakeCompleted(user, stakeIndex, netRace, feeRace);
    }

    function _matureStake(address user, uint256 stakeIndex) internal {
        StakeInfo storage s = _stakes[user][stakeIndex];
        MaturityEmiInfo storage emi = _maturityEmis[user][stakeIndex];

        require(!s.withdrawn, "wrs: withdrawn");
        require(!emi.matured, "wrs: already matured");
        require(s.lockPeriod != LOCK_FLEXIBLE, "wrs: flexible no emi");
        require(block.timestamp >= s.unlockAt, "wrs: locked");
        require(maturityTreasury != address(0), "wrs: no treasury");

        uint256 principal = s.stakedRace;
        require(principal > 0, "wrs: empty stake");

        _settleAccruedReward(user, stakeIndex, true);
        s.dailyRateBps = 0;

        uint256 fee = (principal * withdrawalFeeBps) / 10_000;
        uint256 emiPool = principal - fee;
        require(fee > 0 && emiPool > 0, "wrs: bad split");

        uint256 emi1 = (principal * EMI_BPS) / 10_000;
        uint256 emi2 = (principal * EMI_BPS) / 10_000;
        require(emi1 + emi2 <= emiPool, "wrs: emi overflow");
        uint256 emi3 = emiPool - emi1 - emi2;
        require(emi1 + emi2 + emi3 == emiPool, "wrs: emi != 90%");

        uint64 maturityAt = uint64(block.timestamp);
        uint64 due1 = maturityAt + uint64(EMI_INTERVAL);
        uint64 due2 = maturityAt + uint64(EMI_INTERVAL * 2);
        uint64 due3 = maturityAt + uint64(EMI_INTERVAL * 3);

        emi.matured = true;
        emi.closed = false;
        emi.maturityAt = maturityAt;
        emi.principalRace = principal;
        emi.feeRace = fee;
        emi.emiPoolRace = emiPool;
        emi.emi1Race = emi1;
        emi.emi2Race = emi2;
        emi.emi3Race = emi3;
        emi.claimed1 = false;
        emi.claimed2 = false;
        emi.claimed3 = false;

        s.stakedRace = emiPool;
        totalLockedRace -= fee;
        totalEmiEscrowRace += emiPool;

        raceToken.safeTransfer(maturityTreasury, fee);

        emit StakeMatured(user, stakeIndex, principal, fee, emiPool, maturityAt);
        emit MaturityFeePaid(user, stakeIndex, maturityTreasury, fee);
        emit EmiScheduleCreated(user, stakeIndex, emi1, emi2, emi3, due1, due2, due3);
    }

    function _claimMaturityEmi(address user, uint256 stakeIndex, uint256 emiNumber) internal {
        require(emiNumber >= 1 && emiNumber <= 3, "wrs: bad emi");

        StakeInfo storage s = _stakes[user][stakeIndex];
        MaturityEmiInfo storage emi = _maturityEmis[user][stakeIndex];
        require(emi.matured, "wrs: not matured");
        require(!emi.closed, "wrs: closed");
        require(!s.withdrawn, "wrs: withdrawn");

        uint256 amount;
        uint64 dueAt;
        if (emiNumber == 1) {
            require(!emi.claimed1, "wrs: emi claimed");
            amount = emi.emi1Race;
            dueAt = emi.maturityAt + uint64(EMI_INTERVAL);
            require(block.timestamp >= dueAt, "wrs: emi early");
            emi.claimed1 = true;
        } else if (emiNumber == 2) {
            require(!emi.claimed2, "wrs: emi claimed");
            amount = emi.emi2Race;
            dueAt = emi.maturityAt + uint64(EMI_INTERVAL * 2);
            require(block.timestamp >= dueAt, "wrs: emi early");
            emi.claimed2 = true;
        } else {
            require(!emi.claimed3, "wrs: emi claimed");
            amount = emi.emi3Race;
            dueAt = emi.maturityAt + uint64(EMI_INTERVAL * 3);
            require(block.timestamp >= dueAt, "wrs: emi early");
            emi.claimed3 = true;
        }

        require(amount > 0, "wrs: zero emi");

        totalEmiEscrowRace -= amount;
        totalLockedRace -= amount;
        s.stakedRace -= amount;

        if (emi.claimed1 && emi.claimed2 && emi.claimed3) {
            emi.closed = true;
            s.withdrawn = true;
            emit StakeCompleted(user, stakeIndex, emi.emiPoolRace, emi.feeRace);
        }

        raceToken.safeTransfer(user, amount);
        emit EmiClaimed(user, stakeIndex, emiNumber, amount, dueAt);
    }

    function _claimReward(address user, uint256 stakeIndex) internal {
        _requireClaimGates(user);
        uint256 rewardRace = _settleAccruedReward(user, stakeIndex, false);
        if (rewardRace > 0) {
            lastSuccessfulClaimAt[user] = block.timestamp;
            emit ClaimCooldownRecorded(user, block.timestamp + claimCooldown);
        }
    }

    function _requireClaimGates(address user) internal view {
        if (icoContract != address(0)) {
            require(IRaceIcoCompletion(icoContract).icoCompleted(), "wrs: ico active");
        }
        require(claimEnabled, "wrs: claim disabled");
        uint256 last = lastSuccessfulClaimAt[user];
        if (last != 0) {
            require(block.timestamp >= last + claimCooldown, "wrs: claim cooldown");
        }
    }

    function _settleAccruedReward(address user, uint256 stakeIndex, bool uncapped) internal returns (uint256 rewardRace) {
        StakeInfo storage s = _stakes[user][stakeIndex];
        require(!s.withdrawn, "wrs: withdrawn");
        require(!_maturityEmis[user][stakeIndex].matured, "wrs: matured");
        require(s.stakedRace > 0, "wrs: empty stake");
        require(s.dailyRateBps > 0, "wrs: no reward rate");

        uint256 daysOwed = uncapped ? _daysOwedUncapped(s) : _daysOwed(s);
        if (daysOwed == 0) return 0;

        uint256 rewardUsdt = (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
        require(rewardUsdt > 0, "wrs: zero reward");

        uint256 price = s.rewardPriceUsdt;
        require(price > 0, "wrs: no stake price");
        rewardRace = (rewardUsdt * 1e18) / price;
        require(rewardRace > 0, "wrs: zero race");

        s.lastRewardAt += daysOwed * 1 days;
        rewardVault.pay(user, rewardRace);

        emit RewardPaid(user, stakeIndex, rewardUsdt, rewardRace, daysOwed, price);
    }

    function _daysOwedUncapped(StakeInfo storage s) internal view returns (uint256) {
        uint256 end = s.lockPeriod == LOCK_FLEXIBLE
            ? block.timestamp
            : (block.timestamp < s.unlockAt ? block.timestamp : s.unlockAt);
        if (end <= s.lastRewardAt) return 0;
        return (end - s.lastRewardAt) / 1 days;
    }

    function _daysOwed(StakeInfo storage s) internal view returns (uint256) {
        uint256 daysOwed = _daysOwedUncapped(s);
        if (daysOwed > maxRewardDays) daysOwed = maxRewardDays;
        return daysOwed;
    }

    function _livePancakeRacePriceUsdt() internal view returns (uint256) {
        return PancakePrice.raceToUsdt(pancakeRouter, address(raceToken), address(usdt), 1 ether);
    }

    function _isIcoCompletedForFlexible() internal view returns (bool) {
        if (icoContract == address(0)) return true;
        return IRaceIcoCompletion(icoContract).icoCompleted();
    }

    function _dailyRateBps(uint256 lockPeriod) internal view returns (uint256) {
        if (lockPeriod == LOCK_FLEXIBLE) return dailyRateFlexibleBps;
        if (lockPeriod == LOCK_180) return dailyRate180Bps;
        if (lockPeriod == LOCK_365) return dailyRate365Bps;
        if (lockPeriod == LOCK_730) return dailyRate730Bps;
        if (lockPeriod == LOCK_1095) return dailyRate1095Bps;
        return 0;
    }
}
