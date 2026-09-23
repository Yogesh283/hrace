// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRaceIcoStakeReceiver} from "../interfaces/IRaceIcoStakeReceiver.sol";

contract MockIcoStakeReceiver is IRaceIcoStakeReceiver {
    uint256 public stakeCount;
    address public lastBuyer;
    uint256 public lastUsdt;
    uint256 public lastRace;
    uint256 public lastLock;
    uint256 public lastPurchaseId;
    bool public revertNext;

    function setRevertNext(bool v) external {
        revertNext = v;
    }

    function openIcoStake(
        address buyer,
        uint256 usdtPaid,
        uint256 raceAmount,
        uint256 lockPeriod,
        uint256 icoPurchaseId
    ) external returns (uint256 stakeIndex) {
        require(!revertNext, "mock: stake fail");
        lastBuyer = buyer;
        lastUsdt = usdtPaid;
        lastRace = raceAmount;
        lastLock = lockPeriod;
        lastPurchaseId = icoPurchaseId;
        stakeIndex = stakeCount;
        stakeCount += 1;
    }
}
