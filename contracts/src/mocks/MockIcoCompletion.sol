// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRaceIcoCompletion} from "../interfaces/IRaceIcoCompletion.sol";
import {IRaceIcoStakeReceiver} from "../interfaces/IRaceIcoStakeReceiver.sol";

/// @dev Test helper: toggle authoritative ICO completion for Engine gates.
contract MockIcoCompletion is IRaceIcoCompletion {
    bool public icoCompleted;

    function setIcoCompleted(bool completed) external {
        icoCompleted = completed;
    }

    /// @dev For tests: call Engine.openIcoStake as the wired icoContract address.
    function openIcoStakeFor(
        address engine,
        address buyer,
        uint256 usdtPaid,
        uint256 raceAmount,
        uint256 lockPeriod,
        uint256 icoPurchaseId
    ) external {
        IRaceIcoStakeReceiver(engine).openIcoStake(buyer, usdtPaid, raceAmount, lockPeriod, icoPurchaseId);
    }
}
