// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IRaceMintable} from "./interfaces/IRaceMintable.sol";
import {IRaceIcoStakeReceiver} from "./interfaces/IRaceIcoStakeReceiver.sol";

/**
 * @title RaceICO
 * @notice Official RACE ICO — USDT → admin; RACE minted to CommunityEngine stake (not buyer wallet).
 * @dev Fixed on-chain prices. Hard ICO mint limit: totalSoldRace <= 600_000.
 *      purchase(usdtAmount, lockPeriod) is atomic with openIcoStake on stakingEngine.
 *
 * Phases (immutable):
 *   Phase 1: $0.25 / RACE — 200,000 RACE — max $50,000 USDT
 *   Phase 2: $0.35 / RACE — 200,000 RACE — max $70,000 USDT
 *   Phase 3: $0.45 / RACE — 200,000 RACE — max $90,000 USDT
 *
 * Stake plans for ICO (lockPeriod seconds): 180d / 365d / 730d / 1095d only.
 * Flexible (0) is NOT allowed on ICO purchases — use post-ICO Engine.participate after icoCompleted.
 */
contract RaceICO is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint8 public constant PHASE_COUNT = 3;
    uint256 public constant TOTAL_ALLOCATION = 600_000 ether;
    uint256 public constant PHASE_ALLOCATION = 200_000 ether;
    uint256 public constant LOCK_FLEXIBLE = 0;
    uint256 public constant LOCK_180 = 180 days;
    uint256 public constant LOCK_365 = 365 days;
    uint256 public constant LOCK_730 = 730 days;
    uint256 public constant LOCK_1095 = 1095 days;

    IERC20 public immutable raceToken;
    IERC20 public immutable usdt;
    uint8 public immutable raceDecimals;
    uint8 public immutable usdtDecimals;

    address public adminWallet;
    /// @notice RaceCommunityEngine (IRaceIcoStakeReceiver) — ICO RACE minted here then staked.
    address public stakingEngine;

    uint256 public immutable phase1PriceUsdt;
    uint256 public immutable phase2PriceUsdt;
    uint256 public immutable phase3PriceUsdt;

    uint256 public immutable phase1UsdtCap;
    uint256 public immutable phase2UsdtCap;
    uint256 public immutable phase3UsdtCap;

    struct Phase {
        uint256 priceUsdt;
        uint256 allocation;
        uint256 sold;
        uint256 raisedUsdt;
        bool started;
        bool completed;
        uint64 startedAt;
        uint64 completedAt;
    }

    struct Purchase {
        address buyer;
        uint8 phaseId;
        uint256 raceAmount;
        uint256 usdtPaid;
        uint256 priceUsdt;
        uint64 purchasedAt;
        uint64 unlockAt; // stake unlock hint (0 if flexible)
        uint256 claimed; // race delivered to stake (== raceAmount)
        uint256 lockPeriod;
        uint256 stakeIndex;
    }

    Phase[4] private _phases;
    Purchase[] private _purchases;

    mapping(address => uint256[]) private _userPurchaseIds;
    mapping(address => uint256) public userContributedUsdt;

    /// @notice Always 0 in mint-to-user model (ABI compatibility).
    uint256 public totalLockedRace;

    /// @notice Cumulative RACE minted via ICO (must stay ≤ TOTAL_ALLOCATION).
    uint256 public totalSoldRace;

    uint256 public totalRaisedUsdt;
    uint256 public totalUsdtWithdrawn;
    uint256 public maxContributionUsdt;
    uint8 public currentPhaseId;
    bool public icoCompleted;
    uint64 public icoCompletedAt;

    event ICOPhaseStarted(uint8 indexed phaseId, uint256 priceUsdt, uint256 allocation, uint64 timestamp);
    event ICOPhaseCompleted(uint8 indexed phaseId, uint256 sold, uint256 raisedUsdt, uint64 timestamp);
    event ICOPurchase(
        address indexed buyer,
        uint256 indexed purchaseId,
        uint8 phaseId,
        uint256 usdtPaid,
        uint256 raceAmount,
        uint256 priceUsdt,
        uint64 unlockAt,
        uint64 timestamp
    );
    event ICOPurchased(
        uint256 indexed purchaseId,
        address indexed buyer,
        uint8 phase,
        uint256 usdtAmount,
        uint256 raceAmount,
        uint256 price
    );
    event UsdtTransferredToAdmin(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 indexed purchaseId
    );
    event RaceMintedToStaking(
        address indexed stakingEngine,
        address indexed buyer,
        uint256 indexed purchaseId,
        uint256 raceAmount,
        uint256 lockPeriod,
        uint256 stakeIndex
    );
    event StakingEngineUpdated(address indexed stakingEngine);
    event ICOCompleted(uint256 totalSoldRace, uint256 totalRaisedUsdt, uint64 timestamp);
    event USDTDeposited(address indexed from, uint256 amount);
    event ExcessUSDTWithdrawn(address indexed to, uint256 amount);
    event AccidentalRACEWithdrawn(address indexed to, uint256 amount);
    event MaxContributionUpdated(uint256 amount);
    event AdminWalletUpdated(address indexed adminWallet);

    constructor(address initialOwner, address raceToken_, address usdt_, address adminWallet_) Ownable(initialOwner) {
        require(raceToken_ != address(0), "RaceICO: zero race");
        require(usdt_ != address(0), "RaceICO: zero usdt");
        require(adminWallet_ != address(0), "RaceICO: zero admin");

        raceToken = IERC20(raceToken_);
        usdt = IERC20(usdt_);
        adminWallet = adminWallet_;

        raceDecimals = IERC20Metadata(raceToken_).decimals();
        usdtDecimals = IERC20Metadata(usdt_).decimals();
        require(raceDecimals == 18, "RaceICO: race decimals");

        uint256 scale = 10 ** uint256(usdtDecimals);
        phase1PriceUsdt = (25 * scale) / 100;
        phase2PriceUsdt = (35 * scale) / 100;
        phase3PriceUsdt = (45 * scale) / 100;
        require(phase1PriceUsdt > 0 && phase2PriceUsdt > 0 && phase3PriceUsdt > 0, "RaceICO: price");

        phase1UsdtCap = 50_000 * scale;
        phase2UsdtCap = 70_000 * scale;
        phase3UsdtCap = 90_000 * scale;

        _phases[1] = Phase({
            priceUsdt: phase1PriceUsdt,
            allocation: PHASE_ALLOCATION,
            sold: 0,
            raisedUsdt: 0,
            started: false,
            completed: false,
            startedAt: 0,
            completedAt: 0
        });
        _phases[2] = Phase({
            priceUsdt: phase2PriceUsdt,
            allocation: PHASE_ALLOCATION,
            sold: 0,
            raisedUsdt: 0,
            started: false,
            completed: false,
            startedAt: 0,
            completedAt: 0
        });
        _phases[3] = Phase({
            priceUsdt: phase3PriceUsdt,
            allocation: PHASE_ALLOCATION,
            sold: 0,
            raisedUsdt: 0,
            started: false,
            completed: false,
            startedAt: 0,
            completedAt: 0
        });
    }

    function getCurrentPhase() external view returns (uint8) {
        return currentPhaseId;
    }

    function getPhasePrice(uint8 phaseId) external view returns (uint256) {
        _requirePhase(phaseId);
        return _phases[phaseId].priceUsdt;
    }

    function getPhaseRemaining(uint8 phaseId) public view returns (uint256) {
        _requirePhase(phaseId);
        Phase storage p = _phases[phaseId];
        return p.allocation - p.sold;
    }

    function totalICOSold() external view returns (uint256) {
        return totalSoldRace;
    }

    /// @notice ICO-only mint counter alias (same as totalSoldRace; ≤ TOTAL_ALLOCATION).
    function totalICOMinted() external view returns (uint256) {
        return totalSoldRace;
    }

    function remainingICOMintAllocation() external view returns (uint256) {
        return TOTAL_ALLOCATION - totalSoldRace;
    }

    function phaseUsdtCap(uint8 phaseId) public view returns (uint256) {
        _requirePhase(phaseId);
        if (phaseId == 1) return phase1UsdtCap;
        if (phaseId == 2) return phase2UsdtCap;
        return phase3UsdtCap;
    }

    function getPhaseUsdtRemaining(uint8 phaseId) public view returns (uint256) {
        _requirePhase(phaseId);
        Phase storage p = _phases[phaseId];
        uint256 cap = phaseUsdtCap(phaseId);
        if (p.raisedUsdt >= cap) return 0;
        return cap - p.raisedUsdt;
    }

    function getPhase(uint8 phaseId)
        external
        view
        returns (
            uint256 priceUsdt,
            uint256 allocation,
            uint256 sold,
            uint256 remaining,
            uint256 raisedUsdt,
            bool started,
            bool completed,
            uint64 startedAt,
            uint64 completedAt
        )
    {
        _requirePhase(phaseId);
        Phase storage p = _phases[phaseId];
        return (
            p.priceUsdt,
            p.allocation,
            p.sold,
            p.allocation - p.sold,
            p.raisedUsdt,
            p.started,
            p.completed,
            p.startedAt,
            p.completedAt
        );
    }

    function purchaseCount() external view returns (uint256) {
        return _purchases.length;
    }

    function getPurchase(uint256 purchaseId)
        external
        view
        returns (
            address buyer,
            uint8 phaseId,
            uint256 raceAmount,
            uint256 usdtPaid,
            uint256 priceUsdt,
            uint64 purchasedAt,
            uint64 unlockAt,
            uint256 claimed,
            bool claimable,
            uint256 lockPeriod,
            uint256 stakeIndex
        )
    {
        require(purchaseId < _purchases.length, "RaceICO: bad id");
        Purchase storage buy = _purchases[purchaseId];
        return (
            buy.buyer,
            buy.phaseId,
            buy.raceAmount,
            buy.usdtPaid,
            buy.priceUsdt,
            buy.purchasedAt,
            buy.unlockAt,
            buy.claimed,
            false,
            buy.lockPeriod,
            buy.stakeIndex
        );
    }

    function getUserPurchaseIds(address user) external view returns (uint256[] memory) {
        return _userPurchaseIds[user];
    }

    function getUserAllocation(address user)
        external
        view
        returns (uint256 raceTotal, uint256 raceClaimed, uint256 raceLocked, uint256 usdtPaid)
    {
        uint256[] storage ids = _userPurchaseIds[user];
        for (uint256 i = 0; i < ids.length; i++) {
            Purchase storage buy = _purchases[ids[i]];
            raceTotal += buy.raceAmount;
            raceClaimed += buy.claimed;
            usdtPaid += buy.usdtPaid;
        }
        raceLocked = 0;
    }

    /// @notice Accidental RACE on this contract (should be 0 in mint-to-user model).
    function withdrawableUnsoldRace() public view returns (uint256) {
        return raceToken.balanceOf(address(this));
    }

    function withdrawableRaisedUsdt() public view returns (uint256) {
        return usdt.balanceOf(address(this));
    }

    function setAdminWallet(address adminWallet_) external onlyOwner {
        require(adminWallet_ != address(0), "RaceICO: zero admin");
        adminWallet = adminWallet_;
        emit AdminWalletUpdated(adminWallet_);
    }

    function setStakingEngine(address stakingEngine_) external onlyOwner {
        require(stakingEngine_ != address(0), "RaceICO: zero engine");
        stakingEngine = stakingEngine_;
        emit StakingEngineUpdated(stakingEngine_);
    }

    function isValidStakePlan(uint256 lockPeriod) public pure returns (bool) {
        // ICO = fixed plans only. Flexible is post-ICO via RaceCommunityEngine.participate.
        return lockPeriod == LOCK_180 || lockPeriod == LOCK_365 || lockPeriod == LOCK_730
            || lockPeriod == LOCK_1095;
    }

    function quoteRaceOut(uint8 phaseId, uint256 usdtAmount) public view returns (uint256 raceOut) {
        _requirePhase(phaseId);
        require(usdtAmount > 0, "RaceICO: zero usdt");
        uint256 price = _phases[phaseId].priceUsdt;
        raceOut = (usdtAmount * (10 ** uint256(raceDecimals))) / price;
        require(raceOut > 0, "RaceICO: dust");
    }

    function quoteUsdtIn(uint8 phaseId, uint256 raceAmount) public view returns (uint256 usdtIn) {
        _requirePhase(phaseId);
        require(raceAmount > 0, "RaceICO: zero race");
        uint256 price = _phases[phaseId].priceUsdt;
        usdtIn = (raceAmount * price) / (10 ** uint256(raceDecimals));
        require(usdtIn > 0, "RaceICO: dust");
    }

    function startPhase(uint8 phaseId) external onlyOwner whenNotPaused {
        _requirePhase(phaseId);
        require(!icoCompleted, "RaceICO: completed");
        Phase storage p = _phases[phaseId];
        require(!p.started, "RaceICO: already started");
        require(!p.completed, "RaceICO: already completed");

        if (phaseId == 1) {
            require(currentPhaseId == 0, "RaceICO: not first");
        } else {
            require(_phases[phaseId - 1].completed, "RaceICO: prev incomplete");
            require(currentPhaseId == 0 || currentPhaseId == phaseId - 1, "RaceICO: wrong order");
        }

        p.started = true;
        p.startedAt = uint64(block.timestamp);
        p.priceUsdt = phaseId == 1 ? phase1PriceUsdt : phaseId == 2 ? phase2PriceUsdt : phase3PriceUsdt;
        currentPhaseId = phaseId;

        emit ICOPhaseStarted(phaseId, p.priceUsdt, p.allocation, p.startedAt);
    }

    function completeCurrentPhase() external onlyOwner {
        require(currentPhaseId != 0, "RaceICO: no phase");
        _completePhase(currentPhaseId);
    }

    function setMaxContributionUsdt(uint256 amount) external onlyOwner {
        maxContributionUsdt = amount;
        emit MaxContributionUpdated(amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function depositUSDT(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "RaceICO: zero");
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        emit USDTDeposited(msg.sender, amount);
    }

    /// @notice Sweep accidental RACE (ICO does not hold user allocations).
    function withdrawAccidentalRACE(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "RaceICO: zero to");
        require(amount > 0, "RaceICO: zero");
        require(amount <= raceToken.balanceOf(address(this)), "RaceICO: exceeds balance");
        raceToken.safeTransfer(to, amount);
        emit AccidentalRACEWithdrawn(to, amount);
    }

    /// @notice Alias kept for older admin UIs — same as withdrawAccidentalRACE.
    function withdrawUnsoldRACE(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "RaceICO: zero to");
        require(amount > 0, "RaceICO: zero");
        require(amount <= raceToken.balanceOf(address(this)), "RaceICO: exceeds unsold");
        raceToken.safeTransfer(to, amount);
        emit AccidentalRACEWithdrawn(to, amount);
    }

    function withdrawExcessUSDT(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "RaceICO: zero to");
        require(amount > 0, "RaceICO: zero");
        require(amount <= usdt.balanceOf(address(this)), "RaceICO: insufficient usdt");
        totalUsdtWithdrawn += amount;
        usdt.safeTransfer(to, amount);
        emit ExcessUSDTWithdrawn(to, amount);
    }

    /**
     * @notice Buy ICO RACE into a staking plan. Atomic: USDT→admin, mint→engine, openIcoStake.
     * @param usdtAmount USDT to spend (18 decimals).
     * @param lockPeriod Fixed plan only: 180 / 365 / 730 / 1095 days (seconds). Flexible rejected.
     */
    function purchase(uint256 usdtAmount, uint256 lockPeriod)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 purchaseId)
    {
        require(usdtAmount > 0, "RaceICO: zero usdt");
        require(isValidStakePlan(lockPeriod), "RaceICO: bad plan");
        require(currentPhaseId != 0, "RaceICO: no active phase");
        require(!icoCompleted, "RaceICO: completed");
        require(adminWallet != address(0), "RaceICO: no admin");
        require(stakingEngine != address(0), "RaceICO: no engine");

        uint8 phaseId = currentPhaseId;
        Phase storage p = _phases[phaseId];
        require(p.started && !p.completed, "RaceICO: phase inactive");

        if (maxContributionUsdt > 0) {
            require(userContributedUsdt[msg.sender] + usdtAmount <= maxContributionUsdt, "RaceICO: cap");
        }

        uint256 raceOut = quoteRaceOut(phaseId, usdtAmount);
        require(p.raisedUsdt + usdtAmount <= phaseUsdtCap(phaseId), "RaceICO: phase usdt cap");
        require(p.sold + raceOut <= p.allocation, "RaceICO: phase sold out");
        require(totalSoldRace + raceOut <= TOTAL_ALLOCATION, "RaceICO: total sold out");

        p.sold += raceOut;
        p.raisedUsdt += usdtAmount;
        totalSoldRace += raceOut;
        totalRaisedUsdt += usdtAmount;
        userContributedUsdt[msg.sender] += usdtAmount;

        uint64 purchasedAt = uint64(block.timestamp);
        uint64 unlockAtHint = lockPeriod == LOCK_FLEXIBLE ? purchasedAt : purchasedAt + uint64(lockPeriod);

        purchaseId = _purchases.length;
        _purchases.push(
            Purchase({
                buyer: msg.sender,
                phaseId: phaseId,
                raceAmount: raceOut,
                usdtPaid: usdtAmount,
                priceUsdt: p.priceUsdt,
                purchasedAt: purchasedAt,
                unlockAt: unlockAtHint,
                claimed: raceOut,
                lockPeriod: lockPeriod,
                stakeIndex: 0
            })
        );
        _userPurchaseIds[msg.sender].push(purchaseId);

        // Interactions — any failure reverts USDT + mint + stake
        usdt.safeTransferFrom(msg.sender, adminWallet, usdtAmount);
        IRaceMintable(address(raceToken)).mint(stakingEngine, raceOut);
        uint256 stakeIndex =
            IRaceIcoStakeReceiver(stakingEngine).openIcoStake(msg.sender, usdtAmount, raceOut, lockPeriod, purchaseId);
        _purchases[purchaseId].stakeIndex = stakeIndex;

        emit ICOPurchase(msg.sender, purchaseId, phaseId, usdtAmount, raceOut, p.priceUsdt, unlockAtHint, purchasedAt);
        emit ICOPurchased(purchaseId, msg.sender, phaseId, usdtAmount, raceOut, p.priceUsdt);
        emit UsdtTransferredToAdmin(msg.sender, adminWallet, usdtAmount, purchaseId);
        emit RaceMintedToStaking(stakingEngine, msg.sender, purchaseId, raceOut, lockPeriod, stakeIndex);

        if (p.sold == p.allocation) {
            _completePhase(phaseId);
        }
    }

    /// @notice Principal is staked — no separate ICO claim.
    function claim(uint256) external pure {
        revert("RaceICO: staked - use engine claim/withdraw");
    }

    function _completePhase(uint8 phaseId) internal {
        Phase storage p = _phases[phaseId];
        require(p.started && !p.completed, "RaceICO: cannot complete");

        p.completed = true;
        p.completedAt = uint64(block.timestamp);
        currentPhaseId = 0;

        emit ICOPhaseCompleted(phaseId, p.sold, p.raisedUsdt, p.completedAt);

        if (phaseId == PHASE_COUNT) {
            icoCompleted = true;
            icoCompletedAt = p.completedAt;
            emit ICOCompleted(totalSoldRace, totalRaisedUsdt, icoCompletedAt);
        }
    }

    function _requirePhase(uint8 phaseId) internal pure {
        require(phaseId >= 1 && phaseId <= PHASE_COUNT, "RaceICO: bad phase");
    }
}
