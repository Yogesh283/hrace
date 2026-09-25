// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RaceCoinBsc
 * @notice Mainnet RaceCoin where constructor mints full MAX_SUPPLY so explorers
 *         show Max Total Supply = 150,000,000. Admin receives INITIAL_CIRCULATING
 *         via deploy script transfer; remainder stays with owner/Multisig.
 * @dev Income payouts must be funded from the Multisig/reserve bag (transfer),
 *      because remainingMintable is 0 after deploy. Minter mint still gated by max.
 */
contract RaceCoinBsc is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 150_000_000 ether;
    uint256 public constant TOTAL_SUPPLY = MAX_SUPPLY;
    /// @notice Intended admin/LP starting bag (transfer after deploy) — not constructor mint size.
    uint256 public constant INITIAL_CIRCULATING = 1_000_000 ether;
    uint256 public constant FEE_BPS = 400;
    uint256 public constant FEE_PART_BPS = 100;
    uint256 public constant MONTHLY_MINT_CAP_BPS = 100;

    address public autoLiquidity;
    address public treasury;
    address public rewardPool;
    address public devFund;
    address public governance;

    uint256 public currentMintMonth;
    uint256 public mintedThisMonth;

    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isMinter;

    event FeeRecipientsUpdated(
        address autoLiquidity, address treasury, address rewardPool, address devFund
    );
    event FeeExemptUpdated(address account, bool exempt);
    event FeeCollected(address indexed from, uint256 feeAmount);
    event GovernanceUpdated(address governance);
    event GovernanceMint(address indexed to, uint256 amount);
    event MinterUpdated(address indexed account, bool allowed);
    event MinterMint(address indexed minter, address indexed to, uint256 amount);

    modifier onlyGovernance() {
        require(msg.sender == governance || msg.sender == owner(), "RaceCoin: not governance");
        _;
    }

    modifier onlyMinter() {
        require(isMinter[msg.sender], "RaceCoin: not minter");
        _;
    }

    constructor(
        address initialOwner,
        address autoLiquidity_,
        address treasury_,
        address rewardPool_,
        address devFund_
    ) ERC20("Race Coin", "RACE") Ownable(initialOwner) {
        require(autoLiquidity_ != address(0), "RaceCoin: zero liquidity");
        require(treasury_ != address(0), "RaceCoin: zero treasury");
        require(rewardPool_ != address(0), "RaceCoin: zero reward");
        require(devFund_ != address(0), "RaceCoin: zero dev");

        autoLiquidity = autoLiquidity_;
        treasury = treasury_;
        rewardPool = rewardPool_;
        devFund = devFund_;

        _setFeeExempt(initialOwner, true);
        _setFeeExempt(address(this), true);
        _setFeeExempt(autoLiquidity_, true);
        _setFeeExempt(treasury_, true);
        _setFeeExempt(rewardPool_, true);
        _setFeeExempt(devFund_, true);

        // Full cap minted once → explorers show Max Total Supply = 150M.
        _mint(initialOwner, MAX_SUPPLY);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function remainingMintable() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    function setGovernance(address governance_) external onlyOwner {
        governance = governance_;
        emit GovernanceUpdated(governance_);
    }

    function setMinter(address account, bool allowed) external onlyOwner {
        require(account != address(0), "RaceCoin: zero minter");
        isMinter[account] = allowed;
        emit MinterUpdated(account, allowed);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "RaceCoin: zero to");
        require(amount > 0, "RaceCoin: zero amount");
        require(totalSupply() + amount <= MAX_SUPPLY, "RaceCoin: max supply");
        _mint(to, amount);
        emit MinterMint(msg.sender, to, amount);
    }

    function governanceMint(address to, uint256 amount) external onlyGovernance {
        require(to != address(0), "RaceCoin: zero to");
        require(amount > 0, "RaceCoin: zero amount");
        require(totalSupply() + amount <= MAX_SUPPLY, "RaceCoin: max supply");

        uint256 month = block.timestamp / 30 days;
        if (month > currentMintMonth) {
            currentMintMonth = month;
            mintedThisMonth = 0;
        }

        uint256 cap = (MAX_SUPPLY * MONTHLY_MINT_CAP_BPS) / 10_000;
        require(mintedThisMonth + amount <= cap, "RaceCoin: monthly cap");

        mintedThisMonth += amount;
        _mint(to, amount);
        emit GovernanceMint(to, amount);
    }

    function setFeeRecipients(
        address autoLiquidity_,
        address treasury_,
        address rewardPool_,
        address devFund_
    ) external onlyOwner {
        require(autoLiquidity_ != address(0), "RaceCoin: zero liquidity");
        require(treasury_ != address(0), "RaceCoin: zero treasury");
        require(rewardPool_ != address(0), "RaceCoin: zero reward");
        require(devFund_ != address(0), "RaceCoin: zero dev");
        autoLiquidity = autoLiquidity_;
        treasury = treasury_;
        rewardPool = rewardPool_;
        devFund = devFund_;
        emit FeeRecipientsUpdated(autoLiquidity_, treasury_, rewardPool_, devFund_);
    }

    function setFeeExempt(address account, bool exempt) external onlyOwner {
        _setFeeExempt(account, exempt);
    }

    function _setFeeExempt(address account, bool exempt) internal {
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || isFeeExempt[from] || isFeeExempt[to]) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BPS) / 10_000;
        uint256 sendAmount = value - fee;
        super._update(from, to, sendAmount);

        if (fee > 0) {
            uint256 part = (value * FEE_PART_BPS) / 10_000;
            super._update(from, autoLiquidity, part);
            super._update(from, treasury, part);
            super._update(from, rewardPool, part);
            super._update(from, devFund, fee - (part * 3));
            emit FeeCollected(from, fee);
        }
    }
}
