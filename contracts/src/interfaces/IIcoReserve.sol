// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIcoReserve
 * @notice ICO Contract 600k RACE vault. RaceICO pulls sold coins into hold.
 */
interface IIcoReserve {
    function admin() external view returns (address);

    function available() external view returns (uint256);

    function releaseToHold(uint256 amount) external;
}
