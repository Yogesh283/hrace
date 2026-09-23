// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IPancakeRouter02} from "./interfaces/IPancakeRouter.sol";
import {IRaceRewardVault} from "./interfaces/IRaceRewardVault.sol";
import {IRaceIcoStakeReceiver} from "./interfaces/IRaceIcoStakeReceiver.sol";
import {IRaceIcoCompletion} from "./interfaces/IRaceIcoCompletion.sol";
import {IRaceRewardPriceOracle} from "./interfaces/IRaceRewardPriceOracle.sol";
import {PancakePrice} from "./libraries/PancakePrice.sol";

/**
 * @title RaceCommunityEngine
 * @notice Single on-chain entry point for RACE Community Rewards (PDF program).
 * @dev Participation + ICO stakes + referrals, leadership, team rewards.
 *      Stake daily rates (FINAL): Flexible/180=50bps, 365=70, 730=90, 1095=100.
 *      ROI is USD-notional (principalUsdt × bps); reward RACE mint size uses RaceRewardPriceOracle
 *      (NOT raw Pancake spot). Pancake remains for participate swaps / MLM USD→RACE path only.
 *      ICO openIcoStake: FIXED plans only (no Flexible). Flexible only via participate after RaceICO.icoCompleted.
 *      Fixed maturity: settle reward → 10% RaceTreasury → 90% EMI escrow (30/30/rest @ +30/+60/+90d).
 *      Flexible: anytime withdrawStake (10% team rewards fee) — no EMI schedule.
 */
contract RaceCommunityEngine is Ownable, ReentrancyGuard, Pausable, IRaceIcoStakeReceiver {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdt;
    IERC20 public immutable raceToken;
    IPancakeRouter02 public immutable pancakeRouter;
    IRaceRewardVault public immutable rewardVault;

    /// @notice Authoritative RACE/USDT price for claim / compound / withdraw reward settlement.
    IRaceRewardPriceOracle public rewardPriceOracle;

    /// @notice RaceICO authorized to open ICO stakes (mint lands on this contract first).
    address public icoContract;

    /// @notice Absolute minimum stake accepted ($1). Amounts below QUALIFYING count only as team volume.
    uint256 public constant MIN_PARTICIPATION_USDT = 1 ether;
    /// @notice Minimum for ROI, participation activation, referrals, and self-hold ($50).
    uint256 public constant QUALIFYING_PARTICIPATION_USDT = 50 ether;
    uint256 public constant WITHDRAWAL_FEE_BPS = 1000;
    uint256 public constant EMI_BPS = 3000; // 30% of principal per EMI1/EMI2
    uint256 public constant EMI_INTERVAL = 30 days;
    uint256 public constant SLIPPAGE_BPS = 200;
    uint256 public constant MAX_REWARD_DAYS = 30;
    uint256 public constant LEADERSHIP_MIN_DIRECTS = 2;

    uint256 public constant LOCK_FLEXIBLE = 0;
    uint256 public constant LOCK_180 = 180 days;
    uint256 public constant LOCK_365 = 365 days;
    uint256 public constant LOCK_730 = 730 days;
    uint256 public constant LOCK_1095 = 1095 days;

    /// @notice RaceTreasury — receives fixed-stake maturity fee (10%). Set then permanently lock for production.
    address public maturityTreasury;
    /// @notice Once true, maturityTreasury can never be changed (even by owner/governance).
    bool public maturityTreasuryLocked;

    /// @notice Protocol-level claim gate — owner/multisig only. Default false (claims disabled at deploy).
    bool public claimEnabled;
    /// @notice Per-user global claim frequency limit (successful wallet claims only).
    uint256 public constant CLAIM_COOLDOWN = 24 hours;
    mapping(address => uint256) public lastSuccessfulClaimAt;

    uint256 public totalLockedRace;
    uint256 public totalStakesCreated;
    /// @notice RACE held for fixed-stake EMI escrow (subset of contract balance).
    uint256 public totalEmiEscrowRace;

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

    struct MemberInfo {
        bool registered;
        bool participationActive;
        address referrer;
        uint256 participationAt;
        uint256 selfParticipationUsdt;
        uint256 teamParticipationUsdt;
        uint256 teamDailyRoiUsdt;
        uint256 participationDirectCount;
        uint8 currentRank;
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

    mapping(address => MemberInfo) private _members;
    mapping(address => StakeInfo[]) private _stakes;
    mapping(address => mapping(uint256 => bool)) private _leadershipPaid;
    mapping(address => mapping(uint256 => MaturityEmiInfo)) private _maturityEmis;

    uint16[10] private _communityReferralBps;
    uint16[10] private _teamRewardWeights;
    uint16[11] private _leadershipRankBps;
    uint256[11] private _leadershipSelfUsdt;
    uint256[11] private _leadershipTeamUsdt;
    uint8[11] private _leadershipDirects;

    event MemberRegistered(address indexed user, address indexed referrer);
    event MemberActivated(address indexed user, uint256 timestamp);
    event ParticipationPurchased(
        address indexed user,
        uint256 stakeIndex,
        uint256 usdtPaid,
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
    event CommunityReferralPaid(address indexed sponsor, address indexed from, uint256 level, uint256 usdtValue, uint256 racePaid);
    event LeadershipPaid(address indexed user, uint256 day, uint8 rank, uint256 usdtValue, uint256 racePaid);
    event TeamRewardPaid(address indexed sponsor, address indexed from, uint256 level, uint256 racePaid);
    event RankUpdated(address indexed user, uint8 newRank);
    event StakeWithdrawn(address indexed user, uint256 stakeIndex, uint256 raceReturned, uint256 feeRace);
    /// @notice Position closed after principal exit (alias signal for indexers; pairs with StakeWithdrawn).
    event StakeCompleted(address indexed user, uint256 indexed stakeIndex, uint256 raceReturned, uint256 feeRace);
    event IcoContractUpdated(address indexed icoContract);
    event RewardPriceOracleUpdated(address indexed rewardPriceOracle);
    event ICOStakeCreated(
        address indexed user,
        uint256 indexed stakeIndex,
        uint256 indexed icoPurchaseId,
        uint256 usdtPaid,
        uint256 raceStaked,
        uint256 lockPeriod,
        uint256 dailyRateBps,
        uint256 unlockAt
    );
    event RewardCompounded(
        address indexed user,
        uint256 indexed stakeIndex,
        uint256 rewardUsdt,
        uint256 rewardRace,
        uint256 newPrincipalUsdt,
        uint256 newStakedRace
    );
    event MaturityTreasuryUpdated(address indexed maturityTreasury);
    event MaturityTreasuryLocked(address indexed maturityTreasury);
    event StakeMatured(
        address indexed user,
        uint256 indexed stakeIndex,
        uint256 principal,
        uint256 fee,
        uint256 emiPool,
        uint64 maturityAt
    );
    event MaturityFeePaid(
        address indexed user,
        uint256 indexed stakeIndex,
        address indexed treasury,
        uint256 fee
    );
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
        uint64 dueAt
    );
    event ClaimEnabledUpdated(bool enabled);
    event ClaimCooldownRecorded(address indexed user, uint256 nextAllowedClaimAt);

    modifier onlyIco() {
        require(msg.sender == icoContract, "engine: not ico");
        _;
    }

    constructor(
        address initialOwner,
        address usdt_,
        address raceToken_,
        address pancakeRouter_,
        address rewardVault_
    ) Ownable(initialOwner) {
        require(usdt_ != address(0) && raceToken_ != address(0) && pancakeRouter_ != address(0), "zero address");
        require(rewardVault_ != address(0), "zero vault");
        usdt = IERC20(usdt_);
        raceToken = IERC20(raceToken_);
        pancakeRouter = IPancakeRouter02(pancakeRouter_);
        rewardVault = IRaceRewardVault(rewardVault_);
        _initConstants();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setIcoContract(address icoContract_) external onlyOwner {
        require(icoContract_ != address(0), "engine: zero ico");
        icoContract = icoContract_;
        emit IcoContractUpdated(icoContract_);
    }

    /// @notice Enable/disable user reward claims (after ICO completion gate). Owner/multisig only.
    function setClaimEnabled(bool enabled) external onlyOwner {
        claimEnabled = enabled;
        emit ClaimEnabledUpdated(enabled);
    }

    function setRewardPriceOracle(address rewardPriceOracle_) external onlyOwner {
        require(rewardPriceOracle_ != address(0), "engine: zero oracle");
        rewardPriceOracle = IRaceRewardPriceOracle(rewardPriceOracle_);
        emit RewardPriceOracleUpdated(rewardPriceOracle_);
    }

    /// @notice Configure maturity fee destination (RaceTreasury). Reverts after lockMaturityTreasury.
    function setMaturityTreasury(address maturityTreasury_) external onlyOwner {
        require(!maturityTreasuryLocked, "engine: treasury locked");
        require(maturityTreasury_ != address(0), "engine: zero treasury");
        maturityTreasury = maturityTreasury_;
        emit MaturityTreasuryUpdated(maturityTreasury_);
    }

    /// @notice Permanently freeze maturityTreasury. Required before production ownership transfer.
    function lockMaturityTreasury() external onlyOwner {
        require(maturityTreasury != address(0), "engine: no treasury");
        require(!maturityTreasuryLocked, "engine: already locked");
        maturityTreasuryLocked = true;
        emit MaturityTreasuryLocked(maturityTreasury);
    }

    /**
     * @notice Atomic ICO delivery: RaceICO minted `raceAmount` to this contract, then calls this.
     * @dev Buyer never receives spendable ICO principal. FIXED lock plans only — Flexible rejected.
     *      Reward formula remains USD-notional: principalUsdt × dailyRateBps (approved architecture).
     */
    function openIcoStake(
        address buyer,
        uint256 usdtPaid,
        uint256 raceAmount,
        uint256 lockPeriod,
        uint256 icoPurchaseId
    ) external onlyIco nonReentrant whenNotPaused returns (uint256 stakeIndex) {
        require(buyer != address(0), "engine: zero buyer");
        require(usdtPaid > 0 && raceAmount > 0, "engine: zero amounts");
        require(lockPeriod != LOCK_FLEXIBLE, "engine: ico no flexible");
        uint256 dailyRateBps = _dailyRateBps(lockPeriod);
        require(dailyRateBps > 0, "engine: invalid lock");

        MemberInfo storage m = _members[buyer];
        if (!m.registered) {
            _register(buyer, address(0), false);
        }

        bool qualifying = usdtPaid >= QUALIFYING_PARTICIPATION_USDT;
        if (qualifying) {
            bool firstParticipation = !m.participationActive;
            if (firstParticipation) {
                m.participationActive = true;
                m.participationAt = block.timestamp;
                if (m.referrer != address(0)) {
                    _members[m.referrer].participationDirectCount += 1;
                }
            }
            m.selfParticipationUsdt += usdtPaid;
            _updateRank(buyer);
        }

        uint256 stakeDailyRoiUsdt = (usdtPaid * dailyRateBps) / 10_000;
        _addTeamVolume(m.referrer, usdtPaid);
        _addTeamDailyRoi(m.referrer, stakeDailyRoiUsdt);

        // Flexible: unlockAt = now → withdraw anytime. Fixed: start + duration.
        // (ICO path never reaches Flexible — rejected above.)
        uint256 unlockAt = lockPeriod == LOCK_FLEXIBLE ? block.timestamp : block.timestamp + lockPeriod;
        stakeIndex = _stakes[buyer].length;

        _stakes[buyer].push(
            StakeInfo({
                principalUsdt: usdtPaid,
                stakedRace: raceAmount,
                lockPeriod: lockPeriod,
                startedAt: block.timestamp,
                unlockAt: unlockAt,
                lastRewardAt: block.timestamp,
                dailyRateBps: dailyRateBps,
                withdrawn: false
            })
        );

        totalLockedRace += raceAmount;
        totalStakesCreated += 1;

        if (qualifying) {
            _payCommunityReferrals(buyer, usdtPaid);
        }

        emit ICOStakeCreated(
            buyer, stakeIndex, icoPurchaseId, usdtPaid, raceAmount, lockPeriod, dailyRateBps, unlockAt
        );
        emit ParticipationPurchased(buyer, stakeIndex, usdtPaid, raceAmount, lockPeriod, dailyRateBps);
    }

    /**
     * @notice Compound accrued reward into the same stake.
     * @dev Increases principalUsdt + stakedRace. Does NOT reset/extend unlockAt on fixed plans.
     *      Reward RACE is minted to this contract then locked in principal (not user wallet).
     */
    function compoundReward(uint256 stakeIndex) external nonReentrant whenNotPaused {
        StakeInfo storage s = _stakes[msg.sender][stakeIndex];
        require(!s.withdrawn, "engine: withdrawn");
        require(!_maturityEmis[msg.sender][stakeIndex].matured, "engine: matured");
        require(s.stakedRace > 0, "engine: empty stake");

        uint256 daysOwed = _daysOwed(s);
        require(daysOwed > 0, "engine: nothing");

        uint256 rewardUsdt = (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
        require(rewardUsdt > 0, "engine: zero reward");

        uint256 price = _rewardRacePriceUsdt();
        require(price > 0, "engine: no price");
        uint256 rewardRace = (rewardUsdt * 1e18) / price;
        require(rewardRace > 0, "engine: zero race");

        s.lastRewardAt += daysOwed * 1 days;

        // Mint reward into this contract (locked principal), not user wallet.
        rewardVault.pay(address(this), rewardRace);

        uint256 oldDailyRoi = (s.principalUsdt * s.dailyRateBps) / 10_000;
        s.principalUsdt += rewardUsdt;
        s.stakedRace += rewardRace;
        totalLockedRace += rewardRace;

        uint256 newDailyRoi = (s.principalUsdt * s.dailyRateBps) / 10_000;
        if (newDailyRoi > oldDailyRoi) {
            _addTeamDailyRoi(_members[msg.sender].referrer, newDailyRoi - oldDailyRoi);
        }

        emit RewardCompounded(
            msg.sender, stakeIndex, rewardUsdt, rewardRace, s.principalUsdt, s.stakedRace
        );
    }

    // ─── Registry ───────────────────────────────────────────────────────────

    function register(address referrer) external whenNotPaused {
        _register(msg.sender, referrer, false);
    }

    function participate(uint256 usdtAmount, uint256 lockPeriod) external nonReentrant whenNotPaused {
        MemberInfo storage m = _members[msg.sender];
        if (!m.registered) {
            _register(msg.sender, address(0), false);
        }
        require(usdtAmount >= MIN_PARTICIPATION_USDT, "engine: below minimum");

        uint256 configuredRateBps = _dailyRateBps(lockPeriod);
        require(configuredRateBps > 0, "engine: invalid lock");
        if (lockPeriod == LOCK_FLEXIBLE) {
            require(_isIcoCompletedForFlexible(), "engine: flexible after ico only");
        }

        // $1–$49: personal ROI + leadership volume only; no participation activation or referral pay.
        bool qualifying = usdtAmount >= QUALIFYING_PARTICIPATION_USDT;
        uint256 dailyRateBps = configuredRateBps;

        usdt.safeTransferFrom(msg.sender, address(this), usdtAmount);
        uint256 raceReceived = _swapUsdtToRace(usdtAmount);
        require(raceReceived > 0, "engine: swap failed");

        if (qualifying) {
            bool firstParticipation = !m.participationActive;
            if (firstParticipation) {
                m.participationActive = true;
                m.participationAt = block.timestamp;
                if (m.referrer != address(0)) {
                    _members[m.referrer].participationDirectCount += 1;
                }
            }

            m.selfParticipationUsdt += usdtAmount;
            _updateRank(msg.sender);
        }

        // Every stake contributes principal and its ROI to qualified uplines' leadership calculation.
        uint256 stakeDailyRoiUsdt = (usdtAmount * dailyRateBps) / 10_000;
        _addTeamVolume(m.referrer, usdtAmount);
        _addTeamDailyRoi(m.referrer, stakeDailyRoiUsdt);

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

        if (qualifying) {
            _payCommunityReferrals(msg.sender, usdtAmount);
        }

        emit ParticipationPurchased(msg.sender, stakeIndex, usdtAmount, raceReceived, lockPeriod, dailyRateBps);
    }

    function claimReward(uint256 stakeIndex) external nonReentrant whenNotPaused {
        _claimReward(msg.sender, stakeIndex);
    }

    function distributeReward(address user, uint256 stakeIndex) external nonReentrant whenNotPaused {
        require(msg.sender == user, "engine: not user");
        _claimReward(user, stakeIndex);
    }

    /**
     * @notice Flexible-only principal exit. Fixed plans must use matureStake + claimMaturityEmi.
     * @dev Settles accrued reward, 10% team rewards fee, 90% to user immediately. No EMI.
     */
    function withdrawStake(uint256 stakeIndex) external nonReentrant whenNotPaused {
        StakeInfo storage s = _stakes[msg.sender][stakeIndex];
        require(!s.withdrawn, "engine: withdrawn");
        require(!_maturityEmis[msg.sender][stakeIndex].matured, "engine: matured");
        require(s.lockPeriod == LOCK_FLEXIBLE, "engine: use matureStake");
        require(block.timestamp >= s.unlockAt, "engine: locked");

        uint256 amount = s.stakedRace;
        require(amount > 0, "engine: empty stake");

        // CRITICAL: settle ALL accrued reward before closing — never forfeit unclaimed ROI.
        // If settlement fails (oracle/mint), the entire withdrawal reverts.
        _settleAccruedReward(msg.sender, stakeIndex, true);

        uint256 stakeDailyRoiUsdt = (s.principalUsdt * s.dailyRateBps) / 10_000;
        if (stakeDailyRoiUsdt > 0) {
            _subtractTeamDailyRoi(_members[msg.sender].referrer, stakeDailyRoiUsdt);
        }

        s.withdrawn = true;
        totalLockedRace -= amount;

        uint256 feeRace = (amount * WITHDRAWAL_FEE_BPS) / 10_000;
        uint256 netRace = amount - feeRace;

        if (feeRace > 0) {
            _payTeamRewards(msg.sender, feeRace);
        }

        raceToken.safeTransfer(msg.sender, netRace);
        emit StakeWithdrawn(msg.sender, stakeIndex, netRace, feeRace);
        emit StakeCompleted(msg.sender, stakeIndex, netRace, feeRace);
    }

    /**
     * @notice Fixed-plan maturity: settle reward → 10% to RaceTreasury → lock 90% as EMI escrow.
     * @dev EMI1/EMI2 = 30% of principal each; EMI3 = remainder of 90% pool. Claim via claimMaturityEmi.
     */
    function matureStake(uint256 stakeIndex) external nonReentrant whenNotPaused {
        StakeInfo storage s = _stakes[msg.sender][stakeIndex];
        MaturityEmiInfo storage emi = _maturityEmis[msg.sender][stakeIndex];

        require(!s.withdrawn, "engine: withdrawn");
        require(!emi.matured, "engine: already matured");
        require(s.lockPeriod != LOCK_FLEXIBLE, "engine: flexible no emi");
        require(block.timestamp >= s.unlockAt, "engine: locked");
        require(maturityTreasury != address(0), "engine: no treasury");

        uint256 principal = s.stakedRace;
        require(principal > 0, "engine: empty stake");

        // 1) Settle pending maturity reward once (to user wallet; NOT part of EMI principal).
        _settleAccruedReward(msg.sender, stakeIndex, true);

        uint256 stakeDailyRoiUsdt = (s.principalUsdt * s.dailyRateBps) / 10_000;
        if (stakeDailyRoiUsdt > 0) {
            _subtractTeamDailyRoi(_members[msg.sender].referrer, stakeDailyRoiUsdt);
        }

        // Freeze further ROI / compound on escrowed principal.
        s.dailyRateBps = 0;

        // 2) Exactly 10% company fee → RaceTreasury (standard ERC20 transfer).
        uint256 fee = (principal * WITHDRAWAL_FEE_BPS) / 10_000;
        uint256 emiPool = principal - fee;
        require(fee > 0 && emiPool > 0, "engine: bad split");

        // 3) Immutable EMI schedule: 30% / 30% / remainder of pool (= exactly 90%).
        uint256 emi1 = (principal * EMI_BPS) / 10_000;
        uint256 emi2 = (principal * EMI_BPS) / 10_000;
        require(emi1 + emi2 <= emiPool, "engine: emi overflow");
        uint256 emi3 = emiPool - emi1 - emi2;
        require(emi1 + emi2 + emi3 == emiPool, "engine: emi != 90%");

        uint64 maturityAt = uint64(block.timestamp);
        uint64 due1 = maturityAt + uint64(EMI_INTERVAL);
        uint64 due2 = maturityAt + uint64(EMI_INTERVAL * 2);
        uint64 due3 = maturityAt + uint64(EMI_INTERVAL * 3);

        // Effects before interactions (CEI).
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

        totalLockedRace -= fee;
        totalEmiEscrowRace += emiPool;

        // Interactions
        raceToken.safeTransfer(maturityTreasury, fee);

        emit StakeMatured(msg.sender, stakeIndex, principal, fee, emiPool, maturityAt);
        emit MaturityFeePaid(msg.sender, stakeIndex, maturityTreasury, fee);
        emit EmiScheduleCreated(msg.sender, stakeIndex, emi1, emi2, emi3, due1, due2, due3);
    }

    /**
     * @notice Claim one maturity EMI (1, 2, or 3) after its due date. On-chain only; once each.
     */
    function claimMaturityEmi(uint256 stakeIndex, uint256 emiNumber) external nonReentrant whenNotPaused {
        require(emiNumber >= 1 && emiNumber <= 3, "engine: bad emi");

        StakeInfo storage s = _stakes[msg.sender][stakeIndex];
        MaturityEmiInfo storage emi = _maturityEmis[msg.sender][stakeIndex];
        require(emi.matured, "engine: not matured");
        require(!emi.closed, "engine: closed");
        require(!s.withdrawn, "engine: withdrawn");

        uint256 amount;
        uint64 dueAt;
        if (emiNumber == 1) {
            require(!emi.claimed1, "engine: emi claimed");
            amount = emi.emi1Race;
            dueAt = emi.maturityAt + uint64(EMI_INTERVAL);
            require(block.timestamp >= dueAt, "engine: emi early");
            emi.claimed1 = true;
        } else if (emiNumber == 2) {
            require(!emi.claimed2, "engine: emi claimed");
            amount = emi.emi2Race;
            dueAt = emi.maturityAt + uint64(EMI_INTERVAL * 2);
            require(block.timestamp >= dueAt, "engine: emi early");
            emi.claimed2 = true;
        } else {
            require(!emi.claimed3, "engine: emi claimed");
            amount = emi.emi3Race;
            dueAt = emi.maturityAt + uint64(EMI_INTERVAL * 3);
            require(block.timestamp >= dueAt, "engine: emi early");
            emi.claimed3 = true;
        }

        require(amount > 0, "engine: zero emi");

        totalEmiEscrowRace -= amount;
        totalLockedRace -= amount;
        s.stakedRace -= amount;

        if (emi.claimed1 && emi.claimed2 && emi.claimed3) {
            emi.closed = true;
            s.withdrawn = true;
            emit StakeCompleted(msg.sender, stakeIndex, emi.emiPoolRace, emi.feeRace);
        }

        raceToken.safeTransfer(msg.sender, amount);
        emit EmiClaimed(msg.sender, stakeIndex, emiNumber, amount, dueAt);
    }

    /// @notice Keeper hook — call distributeLeadershipForMember per qualified wallet.
    function distributeLeadership(uint256 /* day */) external pure {
        revert("engine: use distributeLeadershipForMember");
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function isRegistered(address user) external view returns (bool) {
        return _members[user].registered;
    }

    function isParticipationActive(address user) external view returns (bool) {
        return _members[user].participationActive;
    }

    function referrerOf(address user) external view returns (address) {
        return _members[user].referrer;
    }

    function memberRank(address user) external view returns (uint8) {
        return _members[user].currentRank;
    }

    function stakeCount(address user) external view returns (uint256) {
        return _stakes[user].length;
    }

    /// @notice Earliest timestamp when user may call claimReward again (0 = no prior successful claim).
    function nextAllowedClaimAt(address user) external view returns (uint256) {
        uint256 last = lastSuccessfulClaimAt[user];
        if (last == 0) return 0;
        return last + CLAIM_COOLDOWN;
    }

    /// @notice True when ICO complete (if wired), claimEnabled, and 24h cooldown satisfied.
    function canClaimRewards(address user) external view returns (bool) {
        if (!claimEnabled) return false;
        if (icoContract != address(0) && !IRaceIcoCompletion(icoContract).icoCompleted()) return false;
        uint256 last = lastSuccessfulClaimAt[user];
        if (last != 0 && block.timestamp < last + CLAIM_COOLDOWN) return false;
        return true;
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
        if (s.withdrawn || s.stakedRace == 0 || _maturityEmis[user][stakeIndex].matured) return 0;
        if (s.dailyRateBps == 0) return 0;
        uint256 daysOwed = _daysOwed(s);
        return (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
    }

    function maturityEmiAt(address user, uint256 stakeIndex) external view returns (MaturityEmiInfo memory) {
        return _maturityEmis[user][stakeIndex];
    }

    /// @notice EMI due timestamps (maturityAt + 30/60/90 days). Zero if not matured.
    function maturityEmiDueAt(address user, uint256 stakeIndex)
        external
        view
        returns (uint64 due1, uint64 due2, uint64 due3)
    {
        MaturityEmiInfo storage emi = _maturityEmis[user][stakeIndex];
        if (!emi.matured) return (0, 0, 0);
        due1 = emi.maturityAt + uint64(EMI_INTERVAL);
        due2 = emi.maturityAt + uint64(EMI_INTERVAL * 2);
        due3 = emi.maturityAt + uint64(EMI_INTERVAL * 3);
    }

    function pendingRewardRace(address user, uint256 stakeIndex) external view returns (uint256) {
        uint256 rewardUsdt = this.pendingRewardUsdt(user, stakeIndex);
        if (rewardUsdt == 0) return 0;
        if (address(rewardPriceOracle) == address(0)) return 0;
        try rewardPriceOracle.racePriceUsdt() returns (uint256 price) {
            if (price == 0) return 0;
            return (rewardUsdt * 1e18) / price;
        } catch {
            return 0;
        }
    }

    function memberStats(address user)
        external
        view
        returns (
            uint256 selfParticipationUsdt,
            uint256 teamParticipationUsdt,
            uint256 teamDailyRoiUsdt,
            uint256 participationDirects,
            uint8 rank
        )
    {
        MemberInfo storage m = _members[user];
        return (
            m.selfParticipationUsdt,
            m.teamParticipationUsdt,
            m.teamDailyRoiUsdt,
            m.participationDirectCount,
            m.currentRank
        );
    }

    // ─── Internal: registry ───────────────────────────────────────────────────

    function _register(address user, address referrer, bool allowUnregisteredReferrer) internal {
        MemberInfo storage m = _members[user];
        require(!m.registered, "engine: registered");
        if (referrer != address(0)) {
            require(referrer != user, "engine: self referral");
            if (!allowUnregisteredReferrer) {
                require(_members[referrer].registered, "engine: referrer not registered");
            }
        }
        m.registered = true;
        m.referrer = referrer;
        emit MemberRegistered(user, referrer);
        emit MemberActivated(user, block.timestamp);
    }

    function _addTeamVolume(address start, uint256 amount) internal {
        address current = start;
        while (current != address(0)) {
            _members[current].teamParticipationUsdt += amount;
            _updateRank(current);
            current = _members[current].referrer;
        }
    }

    function _addTeamDailyRoi(address start, uint256 dailyRoiUsdt) internal {
        if (dailyRoiUsdt == 0) return;

        address current = start;
        while (current != address(0)) {
            _members[current].teamDailyRoiUsdt += dailyRoiUsdt;
            current = _members[current].referrer;
        }
    }

    function _subtractTeamDailyRoi(address start, uint256 dailyRoiUsdt) internal {
        if (dailyRoiUsdt == 0) return;

        address current = start;
        while (current != address(0)) {
            _members[current].teamDailyRoiUsdt -= dailyRoiUsdt;
            current = _members[current].referrer;
        }
    }

    // ─── Internal: community referrals ────────────────────────────────────────

    function _payCommunityReferrals(address buyer, uint256 principalUsdt) internal {
        address current = _members[buyer].referrer;
        for (uint256 level = 1; level <= 10 && current != address(0); level++) {
            // Self $50+ active only — no N-directs gate (matches Laravel ReferralTree).
            if (_members[current].participationActive) {
                uint256 bps = _communityReferralBps[level - 1];
                if (bps > 0) {
                    uint256 usdtValue = (principalUsdt * bps) / 10_000;
                    if (usdtValue > 0) {
                        _payUsdtValueInRace(current, usdtValue);
                        emit CommunityReferralPaid(current, buyer, level, usdtValue, _usdtToRace(usdtValue));
                    }
                }
            }
            current = _members[current].referrer;
        }
    }

    /// @dev Team Rewards only: Level N requires N $50+ activated directs.
    function _qualifiesTeamRewardLevel(address recipient, uint256 level) internal view returns (bool) {
        if (!_members[recipient].participationActive) return false;
        if (level == 1) return true;
        return _members[recipient].participationDirectCount >= level;
    }

    // ─── Internal: team rewards on withdraw ───────────────────────────────────

    function _payTeamRewards(address withdrawer, uint256 feeRace) internal {
        address current = _members[withdrawer].referrer;
        uint256 weightSum = 100;

        for (uint256 level = 1; level <= 10 && current != address(0); level++) {
            if (_qualifiesTeamRewardLevel(current, level)) {
                uint256 weight = _teamRewardWeights[level - 1];
                if (weight > 0) {
                    uint256 share = (feeRace * weight) / weightSum;
                    if (share > 0) {
                        raceToken.safeTransfer(current, share);
                        emit TeamRewardPaid(current, withdrawer, level, share);
                    }
                }
            }
            current = _members[current].referrer;
        }
    }

    // ─── Internal: leadership ───────────────────────────────────────────────

    function _updateRank(address user) internal {
        MemberInfo storage m = _members[user];
        if (m.participationDirectCount < LEADERSHIP_MIN_DIRECTS) {
            if (m.currentRank != 0) {
                m.currentRank = 0;
                emit RankUpdated(user, 0);
            }
            return;
        }

        uint8 newRank;
        for (uint8 r = 1; r <= 11; r++) {
            uint8 idx = r - 1;
            if (
                m.selfParticipationUsdt >= _leadershipSelfUsdt[idx]
                    && m.teamParticipationUsdt >= _leadershipTeamUsdt[idx]
                    && m.participationDirectCount >= _leadershipDirects[idx]
            ) {
                newRank = r;
            }
        }

        if (newRank != m.currentRank) {
            m.currentRank = newRank;
            emit RankUpdated(user, newRank);
        }
    }

    function distributeLeadershipForMember(address user, uint256 day) external nonReentrant whenNotPaused {
        require(day < block.timestamp / 1 days, "engine: future day");
        require(!_leadershipPaid[user][day], "engine: paid");

        MemberInfo storage m = _members[user];
        require(m.currentRank > 0, "engine: no rank");

        uint8 idx = m.currentRank - 1;
        uint256 bps = _leadershipRankBps[idx];
        if (bps == 0 || m.teamDailyRoiUsdt == 0) return;

        // ROI of ROI: rank % applies to downline daily ROI, not team principal volume.
        uint256 usdtValue = (m.teamDailyRoiUsdt * bps) / 10_000;
        if (usdtValue == 0) return;

        _leadershipPaid[user][day] = true;
        _payUsdtValueInRace(user, usdtValue);
        emit LeadershipPaid(user, day, m.currentRank, usdtValue, _usdtToRace(usdtValue));
    }

    // ─── Internal: participation rewards ────────────────────────────────────

    function _claimReward(address user, uint256 stakeIndex) internal {
        _requireClaimGates(user);
        uint256 rewardRace = _settleAccruedReward(user, stakeIndex, false);
        if (rewardRace > 0) {
            lastSuccessfulClaimAt[user] = block.timestamp;
            emit ClaimCooldownRecorded(user, block.timestamp + CLAIM_COOLDOWN);
        }
    }

    function _requireClaimGates(address user) internal view {
        if (icoContract != address(0)) {
            require(IRaceIcoCompletion(icoContract).icoCompleted(), "engine: ico active");
        }
        require(claimEnabled, "engine: claim disabled");
        uint256 last = lastSuccessfulClaimAt[user];
        if (last != 0) {
            require(block.timestamp >= last + CLAIM_COOLDOWN, "engine: claim cooldown");
        }
    }

    /**
     * @dev Pays accrued ROI in RACE via reward vault mint.
     * @param uncapped When true (withdraw path), settle ALL whole days owed (no MAX_REWARD_DAYS cap)
     *                 so accrued reward cannot be forfeited on exit. Claim/compound keep the 30-day cap.
     * @return rewardRace Amount of RACE minted to user (0 if nothing owed).
     */
    function _settleAccruedReward(address user, uint256 stakeIndex, bool uncapped) internal returns (uint256 rewardRace) {
        StakeInfo storage s = _stakes[user][stakeIndex];
        require(!s.withdrawn, "engine: withdrawn");
        // Allow one settlement during matureStake before dailyRateBps is zeroed; block after matured.
        require(!_maturityEmis[user][stakeIndex].matured, "engine: matured");
        require(s.stakedRace > 0, "engine: empty stake");
        require(s.dailyRateBps > 0, "engine: no reward rate");

        uint256 daysOwed = uncapped ? _daysOwedUncapped(s) : _daysOwed(s);
        if (daysOwed == 0) return 0;

        uint256 rewardUsdt = (s.principalUsdt * s.dailyRateBps * daysOwed) / 10_000;
        require(rewardUsdt > 0, "engine: zero reward");

        uint256 price = _rewardRacePriceUsdt();
        rewardRace = (rewardUsdt * 1e18) / price;
        require(rewardRace > 0, "engine: zero race");

        s.lastRewardAt += daysOwed * 1 days;
        rewardVault.pay(user, rewardRace);

        emit RewardPaid(user, stakeIndex, rewardUsdt, rewardRace, daysOwed, price);
    }

    function _daysOwedUncapped(StakeInfo storage s) internal view returns (uint256) {
        // Fixed plans: accrual stops at unlockAt. Flexible: accrues until withdrawn.
        uint256 end = s.lockPeriod == LOCK_FLEXIBLE
            ? block.timestamp
            : (block.timestamp < s.unlockAt ? block.timestamp : s.unlockAt);
        if (end <= s.lastRewardAt) return 0;
        return (end - s.lastRewardAt) / 1 days;
    }

    function _daysOwed(StakeInfo storage s) internal view returns (uint256) {
        uint256 daysOwed = _daysOwedUncapped(s);
        if (daysOwed > MAX_REWARD_DAYS) daysOwed = MAX_REWARD_DAYS;
        return daysOwed;
    }

    // ─── Internal: swaps & payouts ──────────────────────────────────────────

    function _payUsdtValueInRace(address to, uint256 usdtValue) internal {
        uint256 raceAmount = _usdtToRace(usdtValue);
        require(raceAmount > 0, "engine: zero race payout");
        rewardVault.pay(to, raceAmount);
    }

    function _usdtToRace(uint256 usdtAmount) internal view returns (uint256) {
        return PancakePrice.usdtToRace(pancakeRouter, address(usdt), address(raceToken), usdtAmount);
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

    /// @notice Reward mint conversion price — RaceRewardPriceOracle only (never Pancake spot).
    function _rewardRacePriceUsdt() internal view returns (uint256) {
        require(address(rewardPriceOracle) != address(0), "engine: no reward oracle");
        uint256 price = rewardPriceOracle.racePriceUsdt();
        require(price > 0, "engine: no price");
        return price;
    }

    /// @notice Flexible normal staking only after RaceICO.icoCompleted (or no ICO wired).
    function _isIcoCompletedForFlexible() internal view returns (bool) {
        if (icoContract == address(0)) {
            return true;
        }
        return IRaceIcoCompletion(icoContract).icoCompleted();
    }

    /// @notice FINAL plan rates: Flexible/180=0.50%, 365=0.70%, 730=0.90%, 1095=1.00%.
    function _dailyRateBps(uint256 lockPeriod) internal pure returns (uint256) {
        if (lockPeriod == LOCK_FLEXIBLE) return 50;
        if (lockPeriod == LOCK_180) return 50;
        if (lockPeriod == LOCK_365) return 70;
        if (lockPeriod == LOCK_730) return 90;
        if (lockPeriod == LOCK_1095) return 100;
        return 0;
    }

    function _initConstants() internal {
        _communityReferralBps = [300, 100, 100, 50, 25, 25, 25, 25, 25, 25];
        _teamRewardWeights = [25, 15, 12, 10, 9, 8, 6, 5, 5, 5];
        _leadershipRankBps = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000];
        _leadershipSelfUsdt = [
            50 ether, 100 ether, 250 ether, 500 ether, 1000 ether, 2000 ether,
            3000 ether, 4000 ether, 5000 ether, 7000 ether, 10000 ether
        ];
        _leadershipTeamUsdt = [
            2000 ether, 5000 ether, 10000 ether, 25000 ether, 60000 ether, 130000 ether,
            300000 ether, 700000 ether, 2000000 ether, 5000000 ether, 10000000 ether
        ];
        _leadershipDirects = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
}
