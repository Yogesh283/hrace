// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceTreasury
 * @notice 20% treasury reserve + 1% fees. Withdrawals require 3/5 multisig (Pages 18–19, 45).
 * @dev Multisig address can be permanently locked after production wiring.
 */
contract RaceTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    address public multisig;
    bool public multisigLocked;

    event MultisigUpdated(address multisig);
    event MultisigLocked(address multisig);
    event Withdrawn(address indexed to, uint256 amount, string purpose);

    constructor(address initialOwner, address raceToken_, address multisig_) Ownable(initialOwner) {
        require(raceToken_ != address(0), "RaceTreasury: zero token");
        require(multisig_ != address(0), "RaceTreasury: zero multisig");
        raceToken = IERC20(raceToken_);
        multisig = multisig_;
    }

    function setMultisig(address multisig_) external onlyOwner {
        require(!multisigLocked, "RaceTreasury: multisig locked");
        require(multisig_ != address(0), "RaceTreasury: zero multisig");
        multisig = multisig_;
        emit MultisigUpdated(multisig_);
    }

    /// @notice Permanently freeze Multisig controller (blocks 1-of-1 retarget after Multisig owns this).
    function lockMultisig() external onlyOwner {
        require(multisig != address(0), "RaceTreasury: no multisig");
        require(!multisigLocked, "RaceTreasury: already locked");
        multisigLocked = true;
        emit MultisigLocked(multisig);
    }

    function balance() external view returns (uint256) {
        return raceToken.balanceOf(address(this));
    }

    function withdraw(address to, uint256 amount, string calldata purpose) external nonReentrant {
        require(msg.sender == multisig, "RaceTreasury: not multisig");
        require(to != address(0), "RaceTreasury: zero to");
        require(amount > 0, "RaceTreasury: zero amount");
        raceToken.safeTransfer(to, amount);
        emit Withdrawn(to, amount, purpose);
    }
}
