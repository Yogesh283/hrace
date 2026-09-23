// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IncomeVaultFeeLib} from "./lib/IncomeVaultFeeLib.sol";

/**
 * @title RaceIncomeVault
 * @notice On-chain USDT-notional income ledger + user withdrawal (new layer; core RACE contracts untouched).
 * @dev Off-chain income calculation + EIP-712 authorized on-chain settlement.
 */
contract RaceIncomeVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// @dev Matches Laravel IncomeWalletTransaction credit types (bytes32 labels).
    bytes32 public constant INCOME_DAILY_REWARD = keccak256("daily_reward");
    bytes32 public constant INCOME_LEVEL_INCOME = keccak256("level_income");
    bytes32 public constant INCOME_TEAM_INCOME = keccak256("team_income");
    bytes32 public constant INCOME_REFERRAL_INCOME = keccak256("referral_income");
    bytes32 public constant INCOME_OTHER_INCOME = keccak256("other_income");
    bytes32 public constant INCOME_CLAIM = keccak256("income_claim");
    bytes32 public constant INCOME_STAKE_UNLOCK_EMI = keccak256("stake_unlock_emi");

    bytes32 private constant CREDIT_TYPEHASH =
        keccak256("CreditIncome(address user,uint256 amount,bytes32 incomeType,bytes32 referenceId,uint256 deadline)");
    bytes32 private constant MIGRATE_TYPEHASH =
        keccak256("MigrateIncome(address user,uint256 amount,bytes32 migrationId,uint256 deadline)");
    bytes32 private constant TEAM_SETTLEMENT_TYPEHASH = keccak256(
        "TeamWithdrawSettlement(address user,uint256 grossAmount,bytes32 withdrawalId,bytes32 payoutsHash,uint256 deadline)"
    );

    bytes32 private immutable _domainSeparator;

    IERC20 public immutable incomeToken;
    uint8 public immutable tokenDecimals;

    address public settlementSigner;
    address public adminFeeRecipient;
    address public incomeLiquidityPool;

    mapping(address => uint256) public incomeBalance;
    mapping(bytes32 => bool) public processedIncome;
    mapping(bytes32 => bool) public processedWithdrawals;
    mapping(bytes32 => bool) public processedMigrations;

    uint256 public totalCredited;
    uint256 public totalWithdrawnGross;
    uint256 public totalAdminFees;
    uint256 public totalTeamFees;

    event SettlementSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event AdminFeeRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);
    event IncomeLiquidityPoolUpdated(address indexed previousPool, address indexed newPool);

    event IncomeCredited(
        address indexed user,
        bytes32 indexed incomeType,
        bytes32 indexed referenceId,
        uint256 amount,
        address source,
        uint256 timestamp
    );

    event IncomeMigrated(
        address indexed user,
        bytes32 indexed migrationId,
        uint256 amount,
        address indexed source,
        uint256 timestamp
    );

    event IncomeWithdrawal(
        address indexed user,
        uint256 grossAmount,
        uint256 teamReward,
        uint256 adminFee,
        uint256 netAmount,
        bytes32 indexed withdrawalId,
        uint256 timestamp
    );

    event FeeDistributed(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed withdrawalId,
        bytes32 feeKind,
        uint256 timestamp
    );

    error IncomeVault__ZeroAddress();
    error IncomeVault__ZeroAmount();
    error IncomeVault__DuplicateReference();
    error IncomeVault__DuplicateWithdrawal();
    error IncomeVault__DuplicateMigration();
    error IncomeVault__ExpiredDeadline();
    error IncomeVault__InvalidSigner();
    error IncomeVault__InsufficientBalance();
    error IncomeVault__InvalidTeamSettlement();
    error IncomeVault__NetNotPositive();
    error IncomeVault__PayoutOverflow();

    struct TeamPayout {
        address recipient;
        uint256 amount;
    }

    constructor(
        address initialOwner,
        address incomeToken_,
        address settlementSigner_,
        address adminFeeRecipient_,
        address incomeLiquidityPool_
    ) Ownable(initialOwner) {
        if (
            incomeToken_ == address(0) || settlementSigner_ == address(0) || adminFeeRecipient_ == address(0)
                || incomeLiquidityPool_ == address(0)
        ) {
            revert IncomeVault__ZeroAddress();
        }
        incomeToken = IERC20(incomeToken_);
        tokenDecimals = _readDecimals(incomeToken_);
        settlementSigner = settlementSigner_;
        adminFeeRecipient = adminFeeRecipient_;
        incomeLiquidityPool = incomeLiquidityPool_;
        _domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("RaceIncomeVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setSettlementSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert IncomeVault__ZeroAddress();
        emit SettlementSignerUpdated(settlementSigner, newSigner);
        settlementSigner = newSigner;
    }

    function setAdminFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert IncomeVault__ZeroAddress();
        emit AdminFeeRecipientUpdated(adminFeeRecipient, recipient);
        adminFeeRecipient = recipient;
    }

    function setIncomeLiquidityPool(address pool) external onlyOwner {
        if (pool == address(0)) revert IncomeVault__ZeroAddress();
        emit IncomeLiquidityPoolUpdated(incomeLiquidityPool, pool);
        incomeLiquidityPool = pool;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Authorized off-chain settlement → on-chain credit (pulls USDT from liquidity pool).
     */
    function creditIncome(
        address user,
        uint256 amount,
        bytes32 incomeType,
        bytes32 referenceId,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (user == address(0)) revert IncomeVault__ZeroAddress();
        if (amount == 0) revert IncomeVault__ZeroAmount();
        if (block.timestamp > deadline) revert IncomeVault__ExpiredDeadline();
        if (processedIncome[referenceId]) revert IncomeVault__DuplicateReference();

        bytes32 structHash = keccak256(abi.encode(CREDIT_TYPEHASH, user, amount, incomeType, referenceId, deadline));
        _verifySettlementSigner(structHash, signature);

        processedIncome[referenceId] = true;
        incomeToken.safeTransferFrom(incomeLiquidityPool, address(this), amount);
        incomeBalance[user] += amount;
        totalCredited += amount;

        emit IncomeCredited(user, incomeType, referenceId, amount, msg.sender, block.timestamp);
    }

    /**
     * @notice One-time legacy virtual balance migration (distinct event; not normal income).
     */
    function migrateIncome(
        address user,
        uint256 amount,
        bytes32 migrationId,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        if (user == address(0)) revert IncomeVault__ZeroAddress();
        if (amount == 0) revert IncomeVault__ZeroAmount();
        if (block.timestamp > deadline) revert IncomeVault__ExpiredDeadline();
        if (processedMigrations[migrationId]) revert IncomeVault__DuplicateMigration();

        bytes32 structHash = keccak256(abi.encode(MIGRATE_TYPEHASH, user, amount, migrationId, deadline));
        _verifySettlementSigner(structHash, signature);

        processedMigrations[migrationId] = true;
        incomeToken.safeTransferFrom(incomeLiquidityPool, address(this), amount);
        incomeBalance[user] += amount;
        totalCredited += amount;

        emit IncomeMigrated(user, migrationId, amount, msg.sender, block.timestamp);
    }

    /**
     * @notice User-initiated withdrawal; fees on-chain; team ladder via signed settlement payload.
     */
    function withdraw(
        uint256 grossAmount,
        bytes32 withdrawalId,
        TeamPayout[] calldata teamPayouts,
        uint256 teamDeadline,
        bytes calldata teamSignature
    ) external nonReentrant whenNotPaused {
        if (grossAmount == 0) revert IncomeVault__ZeroAmount();
        if (processedWithdrawals[withdrawalId]) revert IncomeVault__DuplicateWithdrawal();
        if (incomeBalance[msg.sender] < grossAmount) revert IncomeVault__InsufficientBalance();

        (uint256 teamReward, uint256 adminFee, uint256 netAmount) =
            IncomeVaultFeeLib.calculateWithdrawalFees(grossAmount, tokenDecimals);
        if (netAmount == 0) revert IncomeVault__NetNotPositive();

        bytes32 payoutsHash = keccak256(abi.encode(teamPayouts));
        if (block.timestamp > teamDeadline) revert IncomeVault__ExpiredDeadline();
        bytes32 teamHash = keccak256(
            abi.encode(TEAM_SETTLEMENT_TYPEHASH, msg.sender, grossAmount, withdrawalId, payoutsHash, teamDeadline)
        );
        _verifySettlementSigner(teamHash, teamSignature);

        uint256 teamPaid;
        uint256 len = teamPayouts.length;
        for (uint256 i = 0; i < len; ) {
            TeamPayout calldata row = teamPayouts[i];
            if (row.recipient == address(0)) revert IncomeVault__ZeroAddress();
            if (row.amount == 0) revert IncomeVault__ZeroAmount();
            teamPaid += row.amount;
            if (teamPaid > teamReward) revert IncomeVault__PayoutOverflow();
            unchecked {
                ++i;
            }
        }

        processedWithdrawals[withdrawalId] = true;
        incomeBalance[msg.sender] -= grossAmount;
        totalWithdrawnGross += grossAmount;

        for (uint256 i = 0; i < len; ) {
            TeamPayout calldata row = teamPayouts[i];
            incomeToken.safeTransfer(row.recipient, row.amount);
            emit FeeDistributed(row.recipient, row.amount, withdrawalId, keccak256("team_level"), block.timestamp);
            unchecked {
                ++i;
            }
        }

        uint256 unallocatedTeam = teamReward - teamPaid;
        if (unallocatedTeam > 0) {
            incomeToken.safeTransfer(adminFeeRecipient, unallocatedTeam);
            emit FeeDistributed(
                adminFeeRecipient, unallocatedTeam, withdrawalId, keccak256("team_unallocated"), block.timestamp
            );
        }

        incomeToken.safeTransfer(adminFeeRecipient, adminFee);
        totalAdminFees += adminFee;
        totalTeamFees += teamPaid + unallocatedTeam;

        incomeToken.safeTransfer(msg.sender, netAmount);

        emit IncomeWithdrawal(msg.sender, grossAmount, teamReward, adminFee, netAmount, withdrawalId, block.timestamp);
        emit FeeDistributed(adminFeeRecipient, adminFee, withdrawalId, keccak256("admin_fee"), block.timestamp);
    }

    function availableBalance(address user) external view returns (uint256) {
        return incomeBalance[user];
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator, structHash));
    }

    function _verifySettlementSigner(bytes32 structHash, bytes calldata signature) internal view {
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != settlementSigner) revert IncomeVault__InvalidSigner();
    }

    function _readDecimals(address token) private view returns (uint8 decimals_) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (ok && data.length >= 32) {
            return abi.decode(data, (uint8));
        }
        return 18;
    }
}
