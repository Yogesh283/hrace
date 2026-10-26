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
    uint256 public lastHoldUsdt;
    uint256 public lastHoldPurchaseId;
    bool public holdProcessed;
    bool public revertNext;
    bool public revertHold;
    uint256 public mockLivePrice = 0.1 ether;

    function setRevertNext(bool v) external {
        revertNext = v;
    }

    function setRevertHold(bool v) external {
        revertHold = v;
    }

    function setLivePrice(uint256 price) external {
        mockLivePrice = price;
    }

    function liveRacePriceUsdt() external view returns (uint256) {
        return mockLivePrice;
    }

    function bindIcoPurchaseReferrer(address buyer, uint256 icoPurchaseId) external {
        lastBuyer = buyer;
        lastHoldPurchaseId = icoPurchaseId;
    }

    function processIcoHold(address buyer, uint256 usdtPaid, uint256 icoPurchaseId) external {
        require(!revertHold, "mock: hold fail");
        lastBuyer = buyer;
        lastHoldUsdt = usdtPaid;
        lastHoldPurchaseId = icoPurchaseId;
        holdProcessed = true;
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
