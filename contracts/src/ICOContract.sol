// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIcoReserve} from "./interfaces/IIcoReserve.sol";
import {IRaceIcoCompletion} from "./interfaces/IRaceIcoCompletion.sol";

/**
 * @title ICOContract
 * @notice ICO Contract — dedicated 600,000 RACE reserve. No panel role.
 * @dev Admin wallet deposits 600k here via depositReserve.
 *      ICO buys send USDT to RaceICO.adminWallet (same admin). Hold + stake stay on RaceICO.
 *      Income mint stays on RaceRewardVault.
 *      Admin cannot withdraw reserve while RaceICO sale is still active.
 */
contract ICOContract is Ownable, ReentrancyGuard, IIcoReserve {
    using SafeERC20 for IERC20;

    uint256 public constant TOTAL_ALLOCATION = 600_000 ether;

    IERC20 public immutable raceToken;
    address public admin;
    address public raceIco;
    bool public raceIcoLocked;
    uint256 public totalDeposited;
    uint256 public totalReleased;

    event IcoAdminUpdated(address indexed admin);
    event RaceIcoUpdated(address indexed raceIco);
    event RaceIcoLocked(address indexed raceIco);
    event ReserveDeposited(address indexed admin, uint256 amount);
    event ReserveWithdrawn(address indexed admin, uint256 amount);
    event ReserveReleased(address indexed to, uint256 amount);
    event LeftoverWithdrawn(address indexed to, uint256 amount);

    constructor(address initialOwner, address raceToken_, address admin_) Ownable(initialOwner) {
        require(raceToken_ != address(0), "ICOContract: zero token");
        require(admin_ != address(0), "ICOContract: zero admin");
        raceToken = IERC20(raceToken_);
        admin = admin_;
        emit IcoAdminUpdated(admin_);
    }

    function setAdmin(address admin_) external onlyOwner {
        require(admin_ != address(0), "ICOContract: zero admin");
        admin = admin_;
        emit IcoAdminUpdated(admin_);
    }

    function setRaceIco(address raceIco_) external onlyOwner {
        require(!raceIcoLocked, "ICOContract: RaceICO locked");
        require(raceIco_ != address(0), "ICOContract: zero RaceICO");
        raceIco = raceIco_;
        emit RaceIcoUpdated(raceIco_);
    }

    function lockRaceIco() external onlyOwner {
        require(raceIco != address(0), "ICOContract: no RaceICO");
        require(!raceIcoLocked, "ICOContract: already locked");
        raceIcoLocked = true;
        emit RaceIcoLocked(raceIco);
    }

    function available() public view returns (uint256) {
        uint256 bal = raceToken.balanceOf(address(this));
        uint256 remainingCap = TOTAL_ALLOCATION - totalReleased;
        return bal < remainingCap ? bal : remainingCap;
    }

    /// @notice Admin deposits RACE from their wallet into this ICO Contract (cap 600k).
    function depositReserve(uint256 amount) external nonReentrant {
        require(msg.sender == admin, "ICOContract: not admin");
        require(amount > 0, "ICOContract: zero");
        require(totalDeposited + amount <= TOTAL_ALLOCATION, "ICOContract: allocation");
        totalDeposited += amount;
        raceToken.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveDeposited(msg.sender, amount);
    }

    /// @notice Admin withdraws unsold RACE only after RaceICO sale completed.
    function withdrawReserve(uint256 amount) external nonReentrant {
        require(msg.sender == admin, "ICOContract: not admin");
        require(amount > 0, "ICOContract: zero");
        _requireSaleEnded();
        uint256 unsold = _unsoldBalance();
        require(amount <= unsold, "ICOContract: sold locked");
        if (totalDeposited >= amount) {
            totalDeposited -= amount;
        } else {
            totalDeposited = 0;
        }
        raceToken.safeTransfer(admin, amount);
        emit ReserveWithdrawn(admin, amount);
    }

    /// @notice RaceICO pulls sold RACE into hold. Cannot exceed 600k released.
    function releaseToHold(uint256 amount) external nonReentrant {
        require(msg.sender == raceIco, "ICOContract: not RaceICO");
        require(amount > 0, "ICOContract: zero");
        require(totalReleased + amount <= TOTAL_ALLOCATION, "ICOContract: allocation");
        require(raceToken.balanceOf(address(this)) >= amount, "ICOContract: reserve empty");
        totalReleased += amount;
        raceToken.safeTransfer(raceIco, amount);
        emit ReserveReleased(raceIco, amount);
    }

    /// @notice Owner (multisig) recovers leftover unsold RACE only after sale end.
    function withdrawLeftover(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "ICOContract: zero to");
        require(amount > 0, "ICOContract: zero");
        _requireSaleEnded();
        uint256 unsold = _unsoldBalance();
        require(amount <= unsold, "ICOContract: sold locked");
        raceToken.safeTransfer(to, amount);
        emit LeftoverWithdrawn(to, amount);
    }

    function _requireSaleEnded() internal view {
        require(raceIco != address(0), "ICOContract: no RaceICO");
        require(IRaceIcoCompletion(raceIco).icoCompleted(), "ICOContract: sale active");
    }

    /// @dev Physical unsold = balance. Accounting floor = deposited - released when consistent.
    function _unsoldBalance() internal view returns (uint256) {
        return raceToken.balanceOf(address(this));
    }
}
