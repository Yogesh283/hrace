// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRaceIncomeHold} from "./interfaces/IRaceIncomeHold.sol";
import {IRaceRewardPriceOracle} from "./interfaces/IRaceRewardPriceOracle.sol";
import {IRaceTeamRewardFromHold} from "./interfaces/IRaceTeamRewardFromHold.sol";

/**
 * @title RaceIncomeHold
 * @notice Per-user on-chain income wallet. Claim/level/leadership RACE is held here, not in the user wallet.
 * @dev Withdraw order (same tx):
 *      1) Admin USDT fee FIRST — $1 if value is $1–$99; 1% if value is $100+.
 *      2) Then 10% of withdrawn RACE → Community Team Rewards L1–L10 (unpaid share → admin RACE).
 *      3) Then 90% RACE to the user wallet.
 *      Creditors (vault/engine) can be permanently locked after wiring.
 *      totalHold tracks credited liabilities vs on-contract balance.
 */
contract RaceIncomeHold is Ownable, ReentrancyGuard, IRaceIncomeHold {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    IERC20 public immutable usdt;
    uint8 public immutable usdtDecimals;

    address public adminWallet;
    address public vault;
    address public engine;
    IRaceRewardPriceOracle public priceOracle;
    bool public creditorsLocked;

    uint256 public constant TEAM_REWARD_BPS = 1000;
    /// @notice Sum of all holdOf balances (must stay ≤ token balance).
    uint256 public totalHold;

    mapping(address => uint256) public holdOf;

    event AdminWalletUpdated(address indexed adminWallet);
    event VaultUpdated(address indexed vault);
    event EngineUpdated(address indexed engine);
    event OracleUpdated(address indexed oracle);
    event CreditorsLocked(address indexed vault, address indexed engine);
    event IncomeHeld(address indexed user, uint256 raceAmount);
    event IncomeWithdrawn(
        address indexed user,
        uint256 raceAmount,
        uint256 netRace,
        uint256 teamRace,
        uint256 valueUsdt,
        uint256 feeUsdt
    );

    modifier onlyCreditor() {
        require(msg.sender == vault || msg.sender == engine, "IncomeHold: not creditor");
        _;
    }

    constructor(
        address initialOwner,
        address raceToken_,
        address usdt_,
        address adminWallet_,
        address oracle_
    ) Ownable(initialOwner) {
        require(raceToken_ != address(0) && usdt_ != address(0), "IncomeHold: zero token");
        require(adminWallet_ != address(0) && oracle_ != address(0), "IncomeHold: zero admin/oracle");
        raceToken = IERC20(raceToken_);
        usdt = IERC20(usdt_);
        usdtDecimals = IERC20Metadata(usdt_).decimals();
        adminWallet = adminWallet_;
        priceOracle = IRaceRewardPriceOracle(oracle_);
    }

    function setAdminWallet(address adminWallet_) external onlyOwner {
        require(adminWallet_ != address(0), "IncomeHold: zero admin");
        adminWallet = adminWallet_;
        emit AdminWalletUpdated(adminWallet_);
    }

    function setVault(address vault_) external onlyOwner {
        require(!creditorsLocked, "IncomeHold: creditors locked");
        require(vault_ != address(0), "IncomeHold: zero vault");
        vault = vault_;
        emit VaultUpdated(vault_);
    }

    function setEngine(address engine_) external onlyOwner {
        require(!creditorsLocked, "IncomeHold: creditors locked");
        require(engine_ != address(0), "IncomeHold: zero engine");
        engine = engine_;
        emit EngineUpdated(engine_);
    }

    /// @notice Permanently freeze vault + engine creditors (blocks credit-authority retarget).
    function lockCreditors() external onlyOwner {
        require(vault != address(0) && engine != address(0), "IncomeHold: wire first");
        require(!creditorsLocked, "IncomeHold: already locked");
        creditorsLocked = true;
        emit CreditorsLocked(vault, engine);
    }

    function setPriceOracle(address oracle_) external onlyOwner {
        require(oracle_ != address(0), "IncomeHold: zero oracle");
        priceOracle = IRaceRewardPriceOracle(oracle_);
        emit OracleUpdated(oracle_);
    }

    function oneUsdt() public view returns (uint256) {
        return 10 ** uint256(usdtDecimals);
    }

    /// @notice Assign already-deposited RACE on this contract to `user`.
    function credit(address user, uint256 raceAmount) external onlyCreditor {
        require(user != address(0) && raceAmount > 0, "IncomeHold: bad credit");
        holdOf[user] += raceAmount;
        totalHold += raceAmount;
        require(raceToken.balanceOf(address(this)) >= totalHold, "IncomeHold: insolvent");
        emit IncomeHeld(user, raceAmount);
    }

    function quoteWithdraw(address user)
        public
        view
        returns (
            uint256 raceAmount,
            uint256 valueUsdt,
            uint256 feeUsdt,
            uint256 teamRace,
            uint256 netRace
        )
    {
        raceAmount = holdOf[user];
        if (raceAmount == 0) return (0, 0, 0, 0, 0);
        teamRace = (raceAmount * TEAM_REWARD_BPS) / 10_000;
        netRace = raceAmount - teamRace;
        (valueUsdt, feeUsdt) = _valueAndFeeUsdt(raceAmount);
    }

    /// @dev Oracle price is 18-decimal USDT per 1 RACE. Scale fee into real USDT decimals (6 on BSC).
    function _valueAndFeeUsdt(uint256 raceAmount) internal view returns (uint256 valueUsdt, uint256 feeUsdt) {
        uint256 price = priceOracle.racePriceUsdt();
        uint256 value18 = (raceAmount * price) / 1e18;
        uint256 one = oneUsdt();
        valueUsdt = (value18 * one) / 1e18;
        if (value18 < 1e18) {
            return (valueUsdt, 0);
        }
        if (value18 < 100e18) {
            feeUsdt = one;
        } else {
            feeUsdt = valueUsdt / 100;
        }
    }

    /// @notice Withdraw held income. Admin USDT fee is taken first, then 10% team RACE, then 90% to caller.
    function withdraw() external nonReentrant {
        (uint256 raceAmount, uint256 valueUsdt, uint256 feeUsdt, uint256 teamRace, uint256 netRace) =
            quoteWithdraw(msg.sender);
        require(raceAmount > 0, "IncomeHold: empty");
        require(valueUsdt >= oneUsdt(), "IncomeHold: min $1");
        require(feeUsdt > 0, "IncomeHold: fee");
        require(raceToken.balanceOf(address(this)) >= raceAmount, "IncomeHold: bal");

        // 1) Admin fee first — if USDT transfer fails, hold is unchanged.
        usdt.safeTransferFrom(msg.sender, adminWallet, feeUsdt);

        holdOf[msg.sender] = 0;
        totalHold -= raceAmount;

        if (teamRace > 0) {
            uint256 paid;
            if (engine != address(0)) {
                paid = IRaceTeamRewardFromHold(engine).distributeIncomeHoldTeamRewards(msg.sender, teamRace);
            }
            if (teamRace > paid) {
                raceToken.safeTransfer(adminWallet, teamRace - paid);
            }
        }

        raceToken.safeTransfer(msg.sender, netRace);
        emit IncomeWithdrawn(msg.sender, raceAmount, netRace, teamRace, valueUsdt, feeUsdt);
    }
}
