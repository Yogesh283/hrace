// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRaceIncomeHold} from "../interfaces/IRaceIncomeHold.sol";
import {IRaceTeamRewardFromHold} from "../interfaces/IRaceTeamRewardFromHold.sol";

/// @notice Test double: credits a configured L1–L10 split, no qualification.
contract MockIncomeHoldTeamEngine is IRaceTeamRewardFromHold {
    IRaceIncomeHold public hold;
    address[] public recipients;
    uint16[] public weights;

    function configure(address hold_, address[] calldata recipients_, uint16[] calldata weights_) external {
        require(recipients_.length == weights_.length, "mock: len");
        hold = IRaceIncomeHold(hold_);
        recipients = recipients_;
        weights = weights_;
    }

    function distributeIncomeHoldTeamRewards(address, uint256 feeRace) external returns (uint256 paid) {
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 share = (feeRace * weights[i]) / 100;
            if (share > 0 && recipients[i] != address(0)) {
                hold.credit(recipients[i], share);
                paid += share;
            }
        }
    }
}
