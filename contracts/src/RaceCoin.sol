// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RaceCoin
 * @notice RACE mintable BEP20.
 * @dev Model:
 *   - On deploy, only 1,000,000 RACE is minted to the owner (ops / LP).
 *   - Remaining supply up to MAX_SUPPLY is minted by authorized ICO + RewardVault minters.
 *   - ICO buy → mint to user/lock; income → mint to user. Admin does not receive income coins.
 *   - Expense / marketing / extra: max 30,000,000 via owner (Multisig 3-of-5) expenseMint.
 *   - Six member incomes can mint via incomeMint (minter or owner) when wired.
 *   - 4% transfer fee (exempt addresses skip).
 *   - Optional governanceMint still capped at 1%/month, within MAX_SUPPLY.
 */
contract RaceCoin is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 150_000_000 ether;
    uint256 public constant INITIAL_MINT = 1_000_000 ether; // 1,000,000 starting circulating supply
    uint256 public constant TOTAL_SUPPLY = MAX_SUPPLY; // backward-compatible name
    uint256 public constant EXPENSE_ALLOCATION = 30_000_000 ether; // 30 million — Multisig only
    uint256 public constant FEE_BPS = 400;
    uint256 public constant FEE_PART_BPS = 100;
    uint256 public constant MONTHLY_MINT_CAP_BPS = 100;

    /// @notice Official member incomes (coding hook). 1=Staking 2=Referral 3=RoiShare 4=Leadership 5=Royalty 6=Team
    uint8 public constant INCOME_STAKING = 1;
    uint8 public constant INCOME_REFERRAL = 2;
    uint8 public constant INCOME_ROI_SHARING = 3;
    uint8 public constant INCOME_LEADERSHIP = 4;
    uint8 public constant INCOME_ROYALTY = 5;
    uint8 public constant INCOME_TEAM_REWARDS = 6;
    uint8 public constant INCOME_KIND_MAX = 6;

    address public autoLiquidity;
    address public treasury;
    address public rewardPool;
    address public devFund;
    address public governance;

    uint256 public currentMintMonth;
    uint256 public mintedThisMonth;
    uint256 public expenseMinted;

    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isMinter;
    mapping(uint8 => uint256) public incomeMintedByKind;

    event FeeRecipientsUpdated(
        address autoLiquidity,
        address treasury,
        address rewardPool,
        address devFund
    );
    event FeeExemptUpdated(address account, bool exempt);
    event FeeCollected(address indexed from, uint256 feeAmount);
    event GovernanceUpdated(address governance);
    event GovernanceMint(address indexed to, uint256 amount);
    event MinterUpdated(address indexed account, bool allowed);
    event MinterMint(address indexed minter, address indexed to, uint256 amount);
    event ExpenseMinted(address indexed to, uint256 amount, uint256 expenseMinted);
    event IncomeMinted(address indexed to, uint256 amount, uint8 indexed kind, address indexed caller);

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

        // Starting circulating supply only — ICO/income mint the remaining supply.
        _mint(initialOwner, INITIAL_MINT);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function remainingMintable() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    function remainingExpense() external view returns (uint256) {
        return EXPENSE_ALLOCATION - expenseMinted;
    }

    function isValidIncomeKind(uint8 kind) public pure returns (bool) {
        return kind >= INCOME_STAKING && kind <= INCOME_KIND_MAX;
    }

    /**
     * @notice Mint RACE for one of the 6 member incomes. Hook for Engine/Vault later.
     * @dev kind: 1 staking · 2 referral · 3 roi sharing · 4 leadership · 5 royalty · 6 team.
     *      Minter (Vault) or owner (Multisig) only. Still bounded by MAX_SUPPLY. Not the 30M expense bucket.
     */
    function incomeMint(address to, uint256 amount, uint8 kind) external {
        require(msg.sender == owner() || isMinter[msg.sender], "RaceCoin: not income minter");
        require(isValidIncomeKind(kind), "RaceCoin: bad income");
        require(to != address(0), "RaceCoin: zero to");
        require(amount > 0, "RaceCoin: zero amount");
        require(totalSupply() + amount <= MAX_SUPPLY, "RaceCoin: max supply");

        incomeMintedByKind[kind] += amount;
        _mint(to, amount);
        emit IncomeMinted(to, amount, kind, msg.sender);
    }

    /**
     * @notice Marketing / dev / extra from the 30M bucket. Owner = Multisig after harden.
     * @dev Any amount ≤ remainingExpense, no monthly %. Still bounded by MAX_SUPPLY.
     */
    function expenseMint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "RaceCoin: zero to");
        require(amount > 0, "RaceCoin: zero amount");
        require(expenseMinted + amount <= EXPENSE_ALLOCATION, "RaceCoin: expense cap");
        require(totalSupply() + amount <= MAX_SUPPLY, "RaceCoin: max supply");

        expenseMinted += amount;
        _mint(to, amount);
        emit ExpenseMinted(to, amount, expenseMinted);
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

    /**
     * @notice Authorized minter mint (ICO / RewardVault). Goes to `to` (user), never requires admin approve per tx.
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "RaceCoin: zero to");
        require(amount > 0, "RaceCoin: zero amount");
        require(totalSupply() + amount <= MAX_SUPPLY, "RaceCoin: max supply");

        _mint(to, amount);
        emit MinterMint(msg.sender, to, amount);
    }

    /**
     * @notice DAO-authorized mint — max 1% of MAX_SUPPLY per calendar month, within max supply.
     */
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
    ) external onlyGovernance {
        require(autoLiquidity_ != address(0), "RaceCoin: zero liquidity");
        require(treasury_ != address(0), "RaceCoin: zero treasury");
        require(rewardPool_ != address(0), "RaceCoin: zero reward");
        require(devFund_ != address(0), "RaceCoin: zero dev");

        _setFeeExempt(autoLiquidity, false);
        _setFeeExempt(treasury, false);
        _setFeeExempt(rewardPool, false);
        _setFeeExempt(devFund, false);

        autoLiquidity = autoLiquidity_;
        treasury = treasury_;
        rewardPool = rewardPool_;
        devFund = devFund_;

        _setFeeExempt(autoLiquidity_, true);
        _setFeeExempt(treasury_, true);
        _setFeeExempt(rewardPool_, true);
        _setFeeExempt(devFund_, true);

        emit FeeRecipientsUpdated(autoLiquidity_, treasury_, rewardPool_, devFund_);
    }

    function setFeeExempt(address account, bool exempt) external onlyGovernance {
        _setFeeExempt(account, exempt);
    }

    function _setFeeExempt(address account, bool exempt) internal {
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        if (isFeeExempt[from] || isFeeExempt[to]) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = (value * FEE_BPS) / 10_000;
        if (fee == 0) {
            super._update(from, to, value);
            return;
        }

        uint256 part = (value * FEE_PART_BPS) / 10_000;
        uint256 net = value - fee;

        super._update(from, autoLiquidity, part);
        super._update(from, treasury, part);
        super._update(from, rewardPool, part);
        super._update(from, devFund, fee - (part * 3));
        super._update(from, to, net);

        emit FeeCollected(from, fee);
    }
}
