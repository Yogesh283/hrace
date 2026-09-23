// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IRaceIcoCompletion} from "./interfaces/IRaceIcoCompletion.sol";
import {IRaceFundDeposit} from "./interfaces/IRaceFundDeposit.sol";

/**
 * @title RaceLendingBorrowing
 * @notice Isolated USDT lending module (Smart Lending + Smart Pro). Does NOT modify CommunityEngine storage.
 * @dev RACE “position” is recorded as on-chain notional (Option B) for indexer/Laravel; Engine is not called.
 *      91–180 day income accrual is BLOCKED — not implemented (no guessed formulas).
 */
contract RaceLendingBorrowing is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant SMART_LENDING_MIN = 100 ether;
    uint256 public constant SMART_LENDING_MAX = 499 ether;
    uint256 public constant SMART_PRO_AMOUNT_500 = 500 ether;
    uint256 public constant SMART_PRO_AMOUNT_1000 = 1000 ether;

    uint256 public constant SMART_LENDING_DURATION = 7 days;
    uint256 public constant SMART_PRO_PROGRAM_DURATION = 180 days;

    uint256 public constant SECURITY_BPS_SMART = 2000; // 20%
    uint256 public constant SECURITY_BPS_PRO = 3000; // 30%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public constant PRO_SCHEDULE_CHARGE = 50 ether;

    uint8 public constant MAX_PRO_INSTALLMENTS = 3;

    enum ProductType {
        None,
        SmartLending,
        SmartPro
    }

    enum RepaymentOption {
        None,
        Days30,
        Days90,
        Days180
    }

    enum PositionStatus {
        None,
        Active,
        Repaid,
        Defaulted,
        Matured,
        Closed
    }

    struct Position {
        uint256 positionId;
        address user;
        uint256 selectedAmount;
        uint256 securityAmount;
        uint256 disbursementAmount;
        uint256 repaymentAmount;
        uint256 repaidAmount;
        uint48 startTime;
        uint48 dueTime;
        uint48 programEndTime;
        PositionStatus status;
        ProductType productType;
        RepaymentOption repaymentOption;
        uint8 chargesPaidMask;
        uint256 chargesPaidTotal;
        bool principalRepaid;
        uint256 racePositionNotional;
    }

    struct ProductTerms {
        ProductType productType;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 allowedAmountA;
        uint256 allowedAmountB;
        uint256 securityBps;
        uint256 disbursementBps;
        uint256 durationSeconds;
        uint256 programSeconds;
        uint256 scheduleChargeAmount;
    }

    struct RepaymentStatusView {
        PositionStatus status;
        uint256 repaymentAmount;
        uint256 repaidAmount;
        uint256 remainingPrincipal;
        uint8 chargesPaidMask;
        uint256 chargesPaidTotal;
        uint256 chargesDueCount;
        uint256 chargesPaidCount;
        bool principalRepaid;
        uint48 nextChargeDueTime;
        uint48 principalDueTime;
        bool canRepayPrincipal;
        bool isDefaultEligible;
    }

    IERC20 public immutable usdt;
    IERC20 public immutable raceToken;
    IRaceIcoCompletion public immutable raceIco;
    IRaceFundDeposit public usdtTreasury;

    uint256 public nextPositionId = 1;

    mapping(uint256 => Position) private _positions;
    mapping(address => uint256[]) private _userPositionIds;
    mapping(uint256 => mapping(uint8 => bool)) public chargePaid;
    mapping(uint256 => bytes32) public lastRepaymentRef;

    event LendingCreated(
        uint256 indexed positionId,
        address indexed user,
        ProductType productType,
        RepaymentOption repaymentOption,
        uint256 selectedAmount,
        uint256 securityAmount,
        uint256 disbursementAmount,
        uint256 repaymentAmount,
        uint256 racePositionNotional,
        uint48 startTime,
        uint48 dueTime,
        uint48 programEndTime
    );

    event SecurityDeposited(
        uint256 indexed positionId,
        address indexed user,
        address indexed treasury,
        uint256 amount,
        uint256 timestamp
    );

    event LoanDisbursed(
        uint256 indexed positionId,
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    event RepaymentMade(
        uint256 indexed positionId,
        address indexed user,
        bytes32 indexed repaymentRef,
        uint256 amount,
        uint256 totalRepaid,
        uint256 remaining,
        RepaymentOption repaymentOption,
        uint256 timestamp
    );

    event RepaymentScheduled(
        uint256 indexed positionId,
        uint8 installmentIndex,
        uint256 chargeAmount,
        uint48 dueTime
    );

    event RepaymentSettled(
        uint256 indexed positionId,
        address indexed user,
        ProductType productType,
        PositionStatus finalStatus,
        uint256 timestamp
    );

    event PositionMatured(uint256 indexed positionId, address indexed user, uint48 maturedAt);

    event PositionClosed(uint256 indexed positionId, address indexed user, PositionStatus status);

    event DefaultRecorded(uint256 indexed positionId, address indexed user, uint48 recordedAt);

    event TreasuryPayment(
        uint256 indexed positionId,
        address indexed payer,
        address indexed treasury,
        uint256 amount,
        bytes32 paymentKind,
        uint256 timestamp
    );

    event LendingPaused(address indexed account);
    event LendingUnpaused(address indexed account);

    event UsdtTreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    error Lending__ZeroAddress();
    error Lending__ZeroAmount();
    error Lending__IcoNotComplete();
    error Lending__InvalidProduct();
    error Lending__InvalidAmount();
    error Lending__InvalidRepaymentOption();
    error Lending__InsufficientLiquidity();
    error Lending__NotPositionOwner();
    error Lending__InvalidPositionState();
    error Lending__DuplicateRepayment();
    error Lending__Overpayment();
    error Lending__RepaymentTooEarly();
    error Lending__RepaymentTooLate();
    error Lending__ChargeNotDue();
    error Lending__ChargeAlreadyPaid();
    error Lending__InvalidInstallment();
    error Lending__ChargesOutstanding();
    error Lending__InvalidTreasury();
    error Lending__UnauthorizedAdmin();
    error Lending__BusinessRuleBlocked91To180();

    bytes32 public constant PAYMENT_KIND_SECURITY = keccak256("SECURITY");
    bytes32 public constant PAYMENT_KIND_REPAYMENT = keccak256("REPAYMENT");
    bytes32 public constant PAYMENT_KIND_PRO_CHARGE = keccak256("PRO_CHARGE");

    constructor(
        address initialOwner,
        address usdt_,
        address raceToken_,
        address raceIco_,
        address usdtTreasury_
    ) Ownable(initialOwner) {
        if (usdt_ == address(0) || raceToken_ == address(0) || raceIco_ == address(0)) {
            revert Lending__ZeroAddress();
        }
        usdt = IERC20(usdt_);
        raceToken = IERC20(raceToken_);
        raceIco = IRaceIcoCompletion(raceIco_);
        _setUsdtTreasury(usdtTreasury_);
    }

    function pause() external onlyOwner {
        _pause();
        emit LendingPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit LendingUnpaused(msg.sender);
    }

    function setUsdtTreasury(address treasury_) external onlyOwner {
        _setUsdtTreasury(treasury_);
    }

    /**
     * @notice Fund USDT liquidity used for loan disbursements (not a user-balance withdrawal path).
     */
    function fundLiquidity(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert Lending__ZeroAmount();
        usdt.safeTransferFrom(msg.sender, address(this), amount);
    }

    function isLendingEnabled() public view returns (bool) {
        return raceIco.icoCompleted() && !paused();
    }

    function openSmartLending(uint256 selectedAmount) external nonReentrant whenNotPaused {
        _requireLendingEnabled();
        if (selectedAmount < SMART_LENDING_MIN || selectedAmount > SMART_LENDING_MAX) {
            revert Lending__InvalidAmount();
        }

        uint256 securityAmount = (selectedAmount * SECURITY_BPS_SMART) / BPS_DENOMINATOR;
        uint256 disbursementAmount = selectedAmount - securityAmount;
        uint256 repaymentAmount = disbursementAmount;

        uint256 positionId = _createPosition(
            msg.sender,
            selectedAmount,
            securityAmount,
            disbursementAmount,
            repaymentAmount,
            ProductType.SmartLending,
            RepaymentOption.None,
            uint48(block.timestamp + SMART_LENDING_DURATION),
            uint48(block.timestamp + SMART_LENDING_DURATION)
        );

        _collectSecurity(positionId, msg.sender, securityAmount);
        _disburse(positionId, msg.sender, disbursementAmount);

        emit RepaymentScheduled(positionId, 0, repaymentAmount, uint48(block.timestamp + SMART_LENDING_DURATION));
    }

    function openSmartPro(uint256 selectedAmount, RepaymentOption option)
        external
        nonReentrant
        whenNotPaused
    {
        _requireLendingEnabled();
        if (selectedAmount != SMART_PRO_AMOUNT_500 && selectedAmount != SMART_PRO_AMOUNT_1000) {
            revert Lending__InvalidAmount();
        }
        if (
            option != RepaymentOption.Days30 && option != RepaymentOption.Days90
                && option != RepaymentOption.Days180
        ) {
            revert Lending__InvalidRepaymentOption();
        }

        uint256 securityAmount = (selectedAmount * SECURITY_BPS_PRO) / BPS_DENOMINATOR;
        uint256 disbursementAmount = selectedAmount - securityAmount;
        uint256 repaymentAmount = disbursementAmount;

        uint48 programEnd = uint48(block.timestamp + SMART_PRO_PROGRAM_DURATION);
        uint48 principalDue = _principalDueTime(uint48(block.timestamp), option);

        uint256 positionId = _createPosition(
            msg.sender,
            selectedAmount,
            securityAmount,
            disbursementAmount,
            repaymentAmount,
            ProductType.SmartPro,
            option,
            principalDue,
            programEnd
        );

        _collectSecurity(positionId, msg.sender, securityAmount);
        _disburse(positionId, msg.sender, disbursementAmount);

        _emitProSchedule(positionId, option, uint48(block.timestamp));
    }

    function repaySmartLending(uint256 positionId, bytes32 repaymentRef)
        external
        nonReentrant
        whenNotPaused
    {
        Position storage pos = _activePosition(positionId, msg.sender);
        if (pos.productType != ProductType.SmartLending) revert Lending__InvalidProduct();
        if (repaymentRef == bytes32(0)) revert Lending__ZeroAmount();
        if (lastRepaymentRef[positionId] == repaymentRef) revert Lending__DuplicateRepayment();

        uint256 remaining = pos.repaymentAmount - pos.repaidAmount;
        if (remaining == 0) revert Lending__InvalidPositionState();

        _payToTreasury(positionId, msg.sender, remaining, PAYMENT_KIND_REPAYMENT);

        pos.repaidAmount += remaining;
        lastRepaymentRef[positionId] = repaymentRef;

        emit RepaymentMade(
            positionId,
            msg.sender,
            repaymentRef,
            remaining,
            pos.repaidAmount,
            0,
            RepaymentOption.None,
            block.timestamp
        );

        _finalizeSuccess(pos);
    }

    function payProScheduleCharge(uint256 positionId, uint8 installmentIndex, bytes32 paymentRef)
        external
        nonReentrant
        whenNotPaused
    {
        Position storage pos = _activePosition(positionId, msg.sender);
        if (pos.productType != ProductType.SmartPro) revert Lending__InvalidProduct();
        if (paymentRef == bytes32(0)) revert Lending__ZeroAmount();
        if (chargePaid[positionId][installmentIndex]) revert Lending__ChargeAlreadyPaid();

        uint8 maxIndex = _maxChargeIndex(pos.repaymentOption);
        if (installmentIndex > maxIndex) revert Lending__InvalidInstallment();

        uint48 due = _chargeDueTime(pos.startTime, pos.repaymentOption, installmentIndex);
        if (block.timestamp < due) revert Lending__ChargeNotDue();

        bytes32 refKey = keccak256(abi.encodePacked(positionId, installmentIndex, paymentRef));
        if (lastRepaymentRef[positionId] == refKey) revert Lending__DuplicateRepayment();

        _payToTreasury(positionId, msg.sender, PRO_SCHEDULE_CHARGE, PAYMENT_KIND_PRO_CHARGE);

        chargePaid[positionId][installmentIndex] = true;
        pos.chargesPaidMask |= uint8(1 << installmentIndex);
        pos.chargesPaidTotal += PRO_SCHEDULE_CHARGE;
        lastRepaymentRef[positionId] = refKey;

        emit RepaymentMade(
            positionId,
            msg.sender,
            paymentRef,
            PRO_SCHEDULE_CHARGE,
            pos.chargesPaidTotal,
            pos.repaymentAmount - pos.repaidAmount,
            pos.repaymentOption,
            block.timestamp
        );
    }

    function repaySmartProPrincipal(uint256 positionId, bytes32 repaymentRef)
        external
        nonReentrant
        whenNotPaused
    {
        Position storage pos = _activePosition(positionId, msg.sender);
        if (pos.productType != ProductType.SmartPro) revert Lending__InvalidProduct();
        if (pos.principalRepaid) revert Lending__DuplicateRepayment();
        if (repaymentRef == bytes32(0)) revert Lending__ZeroAmount();
        if (lastRepaymentRef[positionId] == repaymentRef) revert Lending__DuplicateRepayment();

        if (block.timestamp < pos.dueTime) revert Lending__RepaymentTooEarly();

        if (!_requiredChargesPaid(pos)) revert Lending__ChargesOutstanding();

        uint256 remaining = pos.repaymentAmount - pos.repaidAmount;
        if (remaining == 0) revert Lending__InvalidPositionState();

        _payToTreasury(positionId, msg.sender, remaining, PAYMENT_KIND_REPAYMENT);

        pos.repaidAmount += remaining;
        pos.principalRepaid = true;
        lastRepaymentRef[positionId] = repaymentRef;

        emit RepaymentMade(
            positionId,
            msg.sender,
            repaymentRef,
            remaining,
            pos.repaidAmount,
            0,
            pos.repaymentOption,
            block.timestamp
        );

        _finalizeSuccess(pos);
    }

    /**
     * @notice Explicitly blocked — 91–180 day income formula not defined in repo.
     */
    function accrueProIncomeDays91To180(uint256) external pure {
        revert Lending__BusinessRuleBlocked91To180();
    }

    function recordDefault(uint256 positionId) external {
        Position storage pos = _positions[positionId];
        if (pos.status != PositionStatus.Active) revert Lending__InvalidPositionState();
        if (block.timestamp <= pos.dueTime) revert Lending__RepaymentTooEarly();
        if (pos.repaidAmount >= pos.repaymentAmount && pos.principalRepaid) {
            revert Lending__InvalidPositionState();
        }

        pos.status = PositionStatus.Defaulted;
        emit DefaultRecorded(positionId, pos.user, uint48(block.timestamp));
        emit PositionClosed(positionId, pos.user, PositionStatus.Defaulted);
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return _positions[positionId];
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return _userPositionIds[user];
    }

    function getProductTerms(ProductType productType) external pure returns (ProductTerms memory terms) {
        if (productType == ProductType.SmartLending) {
            terms = ProductTerms({
                productType: ProductType.SmartLending,
                minAmount: SMART_LENDING_MIN,
                maxAmount: SMART_LENDING_MAX,
                allowedAmountA: 0,
                allowedAmountB: 0,
                securityBps: SECURITY_BPS_SMART,
                disbursementBps: BPS_DENOMINATOR - SECURITY_BPS_SMART,
                durationSeconds: SMART_LENDING_DURATION,
                programSeconds: 0,
                scheduleChargeAmount: 0
            });
        } else if (productType == ProductType.SmartPro) {
            terms = ProductTerms({
                productType: ProductType.SmartPro,
                minAmount: SMART_PRO_AMOUNT_500,
                maxAmount: SMART_PRO_AMOUNT_1000,
                allowedAmountA: SMART_PRO_AMOUNT_500,
                allowedAmountB: SMART_PRO_AMOUNT_1000,
                securityBps: SECURITY_BPS_PRO,
                disbursementBps: BPS_DENOMINATOR - SECURITY_BPS_PRO,
                durationSeconds: 0,
                programSeconds: SMART_PRO_PROGRAM_DURATION,
                scheduleChargeAmount: PRO_SCHEDULE_CHARGE
            });
        } else {
            revert Lending__InvalidProduct();
        }
    }

    function getRepaymentStatus(uint256 positionId) external view returns (RepaymentStatusView memory view_) {
        Position storage pos = _positions[positionId];
        if (pos.positionId == 0) revert Lending__InvalidPositionState();

        view_.status = pos.status;
        view_.repaymentAmount = pos.repaymentAmount;
        view_.repaidAmount = pos.repaidAmount;
        view_.remainingPrincipal = pos.repaymentAmount > pos.repaidAmount
            ? pos.repaymentAmount - pos.repaidAmount
            : 0;
        view_.chargesPaidMask = pos.chargesPaidMask;
        view_.chargesPaidTotal = pos.chargesPaidTotal;
        view_.chargesDueCount = _chargesDueCount(pos.repaymentOption);
        view_.chargesPaidCount = _chargesPaidCount(pos.chargesPaidMask, pos.repaymentOption);
        view_.principalRepaid = pos.principalRepaid;
        view_.principalDueTime = pos.dueTime;
        view_.nextChargeDueTime = _nextChargeDue(pos);
        view_.canRepayPrincipal = pos.status == PositionStatus.Active && block.timestamp >= pos.dueTime
            && _requiredChargesPaid(pos) && !pos.principalRepaid;
        view_.isDefaultEligible = pos.status == PositionStatus.Active && block.timestamp > pos.dueTime
            && (pos.repaidAmount < pos.repaymentAmount || !pos.principalRepaid);
    }

    function getRemainingTime(uint256 positionId) external view returns (uint256 secondsRemaining) {
        Position storage pos = _positions[positionId];
        if (pos.positionId == 0) revert Lending__InvalidPositionState();
        if (block.timestamp >= pos.dueTime) return 0;
        return uint256(pos.dueTime) - block.timestamp;
    }

    function _createPosition(
        address user,
        uint256 selectedAmount,
        uint256 securityAmount,
        uint256 disbursementAmount,
        uint256 repaymentAmount,
        ProductType productType,
        RepaymentOption repaymentOption,
        uint48 dueTime,
        uint48 programEndTime
    ) private returns (uint256 positionId) {
        if (usdt.balanceOf(address(this)) < disbursementAmount) revert Lending__InsufficientLiquidity();

        positionId = nextPositionId++;
        Position storage pos = _positions[positionId];
        pos.positionId = positionId;
        pos.user = user;
        pos.selectedAmount = selectedAmount;
        pos.securityAmount = securityAmount;
        pos.disbursementAmount = disbursementAmount;
        pos.repaymentAmount = repaymentAmount;
        pos.startTime = uint48(block.timestamp);
        pos.dueTime = dueTime;
        pos.programEndTime = programEndTime;
        pos.status = PositionStatus.Active;
        pos.productType = productType;
        pos.repaymentOption = repaymentOption;
        pos.racePositionNotional = selectedAmount;

        _userPositionIds[user].push(positionId);

        emit LendingCreated(
            positionId,
            user,
            productType,
            repaymentOption,
            selectedAmount,
            securityAmount,
            disbursementAmount,
            repaymentAmount,
            selectedAmount,
            pos.startTime,
            dueTime,
            programEndTime
        );
    }

    function _collectSecurity(uint256 positionId, address user, uint256 amount) private {
        usdt.safeTransferFrom(user, address(this), amount);
        usdt.forceApprove(address(usdtTreasury), amount);
        usdtTreasury.deposit(address(usdt), amount);
        emit SecurityDeposited(positionId, user, address(usdtTreasury), amount, block.timestamp);
        emit TreasuryPayment(
            positionId, user, address(usdtTreasury), amount, PAYMENT_KIND_SECURITY, block.timestamp
        );
    }

    function _disburse(uint256 positionId, address user, uint256 amount) private {
        usdt.safeTransfer(user, amount);
        emit LoanDisbursed(positionId, user, amount, block.timestamp);
    }

    function _payToTreasury(
        uint256 positionId,
        address payer,
        uint256 amount,
        bytes32 paymentKind
    ) private {
        usdt.safeTransferFrom(payer, address(this), amount);
        usdt.forceApprove(address(usdtTreasury), amount);
        usdtTreasury.deposit(address(usdt), amount);
        emit TreasuryPayment(positionId, payer, address(usdtTreasury), amount, paymentKind, block.timestamp);
    }

    function _finalizeSuccess(Position storage pos) private {
        pos.status = PositionStatus.Repaid;
        emit PositionMatured(pos.positionId, pos.user, uint48(block.timestamp));
        emit RepaymentSettled(
            pos.positionId, pos.user, pos.productType, PositionStatus.Repaid, block.timestamp
        );
        emit PositionClosed(pos.positionId, pos.user, PositionStatus.Closed);
        pos.status = PositionStatus.Closed;
    }

    function _activePosition(uint256 positionId, address user) private view returns (Position storage pos) {
        pos = _positions[positionId];
        if (pos.positionId == 0 || pos.user != user) revert Lending__NotPositionOwner();
        if (pos.status != PositionStatus.Active) revert Lending__InvalidPositionState();
    }

    function _requireLendingEnabled() private view {
        if (!raceIco.icoCompleted()) revert Lending__IcoNotComplete();
    }

    function _setUsdtTreasury(address treasury_) private {
        if (treasury_ == address(0)) revert Lending__ZeroAddress();
        if (treasury_.code.length == 0) revert Lending__InvalidTreasury();
        if (IRaceFundDeposit(treasury_).usdtToken() != address(usdt)) revert Lending__InvalidTreasury();
        address previous = address(usdtTreasury);
        usdtTreasury = IRaceFundDeposit(treasury_);
        emit UsdtTreasuryUpdated(previous, treasury_);
    }

    function _principalDueTime(uint48 startTime, RepaymentOption option) private pure returns (uint48) {
        if (option == RepaymentOption.Days30) return startTime + 30 days;
        if (option == RepaymentOption.Days90) return startTime + 90 days;
        if (option == RepaymentOption.Days180) return startTime + 180 days;
        revert Lending__InvalidRepaymentOption();
    }

    function _maxChargeIndex(RepaymentOption option) private pure returns (uint8) {
        if (option == RepaymentOption.Days30) return 0;
        if (option == RepaymentOption.Days90) return 2;
        return type(uint8).max; // 180-day: no schedule charges
    }

    function _chargeDueTime(uint48 startTime, RepaymentOption option, uint8 installmentIndex)
        private
        pure
        returns (uint48)
    {
        if (option == RepaymentOption.Days30) {
            if (installmentIndex != 0) revert Lending__InvalidInstallment();
            return startTime + 30 days;
        }
        if (option == RepaymentOption.Days90) {
            if (installmentIndex > 2) revert Lending__InvalidInstallment();
            return startTime + uint48(uint256(installmentIndex + 1) * 30 days);
        }
        revert Lending__InvalidInstallment();
    }

    function _emitProSchedule(uint256 positionId, RepaymentOption option, uint48 startTime) private {
        if (option == RepaymentOption.Days30) {
            emit RepaymentScheduled(positionId, 0, PRO_SCHEDULE_CHARGE, startTime + 30 days);
            emit RepaymentScheduled(positionId, 1, _positions[positionId].repaymentAmount, startTime + 30 days);
        } else if (option == RepaymentOption.Days90) {
            for (uint8 i = 0; i < 3; i++) {
                emit RepaymentScheduled(
                    positionId, i, PRO_SCHEDULE_CHARGE, startTime + uint48(uint256(i + 1) * 30 days)
                );
            }
            emit RepaymentScheduled(positionId, 3, _positions[positionId].repaymentAmount, startTime + 90 days);
        } else {
            emit RepaymentScheduled(
                positionId, 0, _positions[positionId].repaymentAmount, startTime + 180 days
            );
        }
    }

    function _requiredChargesPaid(Position storage pos) private view returns (bool) {
        if (pos.productType != ProductType.SmartPro) return true;
        if (pos.repaymentOption == RepaymentOption.Days180) return true;
        if (pos.repaymentOption == RepaymentOption.Days30) {
            return chargePaid[pos.positionId][0];
        }
        if (pos.repaymentOption == RepaymentOption.Days90) {
            return chargePaid[pos.positionId][0] && chargePaid[pos.positionId][1]
                && chargePaid[pos.positionId][2];
        }
        return false;
    }

    function _chargesDueCount(RepaymentOption option) private pure returns (uint256) {
        if (option == RepaymentOption.Days30) return 1;
        if (option == RepaymentOption.Days90) return 3;
        return 0;
    }

    function _chargesPaidCount(uint8 mask, RepaymentOption option) private pure returns (uint256) {
        uint256 count = 0;
        uint256 due = _chargesDueCount(option);
        for (uint256 i = 0; i < due; i++) {
            if ((mask & uint8(1 << i)) != 0) count++;
        }
        return count;
    }

    function _nextChargeDue(Position storage pos) private view returns (uint48) {
        if (pos.productType != ProductType.SmartPro) return 0;
        if (pos.repaymentOption == RepaymentOption.Days180) return 0;
        uint8 max = _maxChargeIndex(pos.repaymentOption);
        for (uint8 i = 0; i <= max; i++) {
            if (!chargePaid[pos.positionId][i]) {
                return _chargeDueTime(pos.startTime, pos.repaymentOption, i);
            }
        }
        return 0;
    }
}
