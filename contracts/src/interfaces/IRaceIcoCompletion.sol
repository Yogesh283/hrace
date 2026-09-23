// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRaceIcoCompletion
 * @notice RaceCommunityEngine reads authoritative ICO completion from RaceICO.
 */
interface IRaceIcoCompletion {
    function icoCompleted() external view returns (bool);
}
