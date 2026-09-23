// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceMultisigFund
 * @notice Multisig-only expense / ops fund vault (RACE + USDT BEP20).
 * @dev No Ownable. Controller is immutable RaceMultiSig (3-of-5).
 *      Does NOT auto-allocate tokenomics. Funding is via deposit / transfer only.
 *      Withdrawals encode purpose on-chain for audit (called through Multisig calldata).
 */
abstract contract RaceMultisigFund is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Human-readable fund label (DEVELOPMENT / MARKETING / OPERATIONS). Set once; no setter.
    string public fundName;
    address public immutable multisig;
    address public immutable raceToken;
    address public immutable usdtToken;

    event Funded(string fund, address indexed token, address indexed from, uint256 amount);
    event Withdrawn(
        string fund,
        address indexed token,
        address indexed to,
        uint256 amount,
        string purpose
    );

    modifier onlyMultisig() {
        require(msg.sender == multisig, "RaceMultisigFund: not multisig");
        _;
    }

    constructor(string memory fundName_, address multisig_, address raceToken_, address usdtToken_) {
        require(bytes(fundName_).length > 0, "RaceMultisigFund: empty name");
        require(multisig_ != address(0), "RaceMultisigFund: zero multisig");
        require(raceToken_ != address(0), "RaceMultisigFund: zero race");
        require(usdtToken_ != address(0), "RaceMultisigFund: zero usdt");
        require(raceToken_ != usdtToken_, "RaceMultisigFund: race==usdt");

        fundName = fundName_;
        multisig = multisig_;
        raceToken = raceToken_;
        usdtToken = usdtToken_;
    }

    function isAllowedToken(address token) public view returns (bool) {
        return token == raceToken || token == usdtToken;
    }

    function balanceOf(address token) external view returns (uint256) {
        require(isAllowedToken(token), "RaceMultisigFund: bad token");
        return IERC20(token).balanceOf(address(this));
    }

    function raceBalance() external view returns (uint256) {
        return IERC20(raceToken).balanceOf(address(this));
    }

    function usdtBalance() external view returns (uint256) {
        return IERC20(usdtToken).balanceOf(address(this));
    }

    /**
     * @notice Pull deposit of RACE or USDT into this fund (anyone).
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        require(isAllowedToken(token), "RaceMultisigFund: bad token");
        require(amount > 0, "RaceMultisigFund: zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(fundName, token, msg.sender, amount);
    }

    /**
     * @notice Multisig-only outflow. `purpose` is required for on-chain audit trail.
     * @dev Intended call path: RaceMultiSig submit/confirm → this.withdraw(...)
     */
    function withdraw(address token, address to, uint256 amount, string calldata purpose)
        external
        onlyMultisig
        nonReentrant
    {
        require(isAllowedToken(token), "RaceMultisigFund: bad token");
        require(to != address(0), "RaceMultisigFund: zero to");
        require(amount > 0, "RaceMultisigFund: zero amount");
        require(bytes(purpose).length > 0, "RaceMultisigFund: empty purpose");

        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(fundName, token, to, amount, purpose);
    }
}

/**
 * @title RaceDevelopmentTreasury
 * @notice Dev salaries, infra, software — Multisig 3-of-5 only.
 */
contract RaceDevelopmentTreasury is RaceMultisigFund {
    constructor(address multisig_, address raceToken_, address usdtToken_)
        RaceMultisigFund("DEVELOPMENT", multisig_, raceToken_, usdtToken_)
    {}
}

/**
 * @title RaceMarketingTreasury
 * @notice Ads, campaigns, partnerships — Multisig 3-of-5 only.
 */
contract RaceMarketingTreasury is RaceMultisigFund {
    constructor(address multisig_, address raceToken_, address usdtToken_)
        RaceMultisigFund("MARKETING", multisig_, raceToken_, usdtToken_)
    {}
}

/**
 * @title RaceOperationsTreasury
 * @notice Legal, accounting, emergency ops — Multisig 3-of-5 only.
 */
contract RaceOperationsTreasury is RaceMultisigFund {
    constructor(address multisig_, address raceToken_, address usdtToken_)
        RaceMultisigFund("OPERATIONS", multisig_, raceToken_, usdtToken_)
    {}
}
