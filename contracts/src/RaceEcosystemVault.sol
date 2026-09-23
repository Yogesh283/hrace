// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceEcosystemVault
 * @notice 15% ecosystem growth allocation — releases require governance executor (DAO milestone releases).
 */
contract RaceEcosystemVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable raceToken;
    address public governance;

    uint256 public totalReleased;

    event GovernanceUpdated(address governance);
    event Released(address indexed to, uint256 amount, string milestone);

    modifier onlyGovernance() {
        require(msg.sender == governance, "RaceEcosystemVault: not governance");
        _;
    }

    constructor(address initialOwner, address raceToken_, address governance_) Ownable(initialOwner) {
        require(raceToken_ != address(0), "RaceEcosystemVault: zero token");
        require(governance_ != address(0), "RaceEcosystemVault: zero governance");
        raceToken = IERC20(raceToken_);
        governance = governance_;
    }

    function setGovernance(address governance_) external onlyOwner {
        require(governance_ != address(0), "RaceEcosystemVault: zero governance");
        governance = governance_;
        emit GovernanceUpdated(governance_);
    }

    function balance() external view returns (uint256) {
        return raceToken.balanceOf(address(this));
    }

    function release(address to, uint256 amount, string calldata milestone)
        external
        onlyGovernance
        nonReentrant
    {
        require(to != address(0), "RaceEcosystemVault: zero to");
        require(amount > 0, "RaceEcosystemVault: zero amount");
        totalReleased += amount;
        raceToken.safeTransfer(to, amount);
        emit Released(to, amount, milestone);
    }
}
