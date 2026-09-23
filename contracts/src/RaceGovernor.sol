// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRaceStaking} from "./interfaces/IRaceStaking.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceGovernor
 * @notice DAO governance — stake-weighted proposals, voting, timelocked execution (Pages 21–22, 32–34, 44).
 */
contract RaceGovernor is ReentrancyGuard {
    IRaceStaking public immutable staking;

    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant EXECUTION_DELAY = 1 days;
    uint256 public constant QUORUM_BPS = 500; // 5% of total active stake

    struct Proposal {
        address target;
        uint256 value;
        bytes data;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
    }

    Proposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address target,
        string description
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    constructor(address staking_) {
        require(staking_ != address(0), "RaceGovernor: zero staking");
        staking = IRaceStaking(staking_);
    }

    function propose(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external returns (uint256 proposalId) {
        require(staking.registered(msg.sender), "RaceGovernor: not registered");
        require(staking.activeStakeAmount(msg.sender) > 0, "RaceGovernor: stake required");
        require(target != address(0), "RaceGovernor: zero target");

        proposalId = proposals.length;
        proposals.push(
            Proposal({
                target: target,
                value: value,
                data: data,
                description: description,
                startTime: block.timestamp,
                endTime: block.timestamp + VOTING_PERIOD,
                forVotes: 0,
                againstVotes: 0,
                executed: false,
                canceled: false
            })
        );

        emit ProposalCreated(proposalId, msg.sender, target, description);
    }

    function castVote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.startTime, "RaceGovernor: not started");
        require(block.timestamp <= p.endTime, "RaceGovernor: ended");
        require(!p.executed && !p.canceled, "RaceGovernor: closed");
        require(!hasVoted[proposalId][msg.sender], "RaceGovernor: voted");

        uint256 weight = staking.activeStakeAmount(msg.sender);
        require(weight > 0, "RaceGovernor: no stake");

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    function execute(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(!p.executed && !p.canceled, "RaceGovernor: closed");
        require(block.timestamp > p.endTime + EXECUTION_DELAY, "RaceGovernor: timelock");

        uint256 totalStake = staking.totalActiveStake();
        uint256 quorum = (totalStake * QUORUM_BPS) / 10_000;
        require(p.forVotes + p.againstVotes >= quorum, "RaceGovernor: no quorum");
        require(p.forVotes > p.againstVotes, "RaceGovernor: not passed");

        p.executed = true;
        (bool ok, bytes memory returndata) = p.target.call{value: p.value}(p.data);
        if (!ok) {
            if (returndata.length > 0) {
                assembly {
                    revert(add(returndata, 32), mload(returndata))
                }
            }
            revert("RaceGovernor: execution failed");
        }

        emit ProposalExecuted(proposalId);
    }

    function cancel(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "RaceGovernor: executed");
        require(!p.canceled, "RaceGovernor: canceled");
        require(
            staking.activeStakeAmount(msg.sender) > 0 && block.timestamp <= p.endTime,
            "RaceGovernor: cannot cancel"
        );
        p.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function state(uint256 proposalId)
        external
        view
        returns (
            bool active,
            bool passed,
            bool executed,
            bool canceled
        )
    {
        Proposal storage p = proposals[proposalId];
        active = block.timestamp >= p.startTime && block.timestamp <= p.endTime && !p.executed && !p.canceled;
        executed = p.executed;
        canceled = p.canceled;

        uint256 totalStake = staking.totalActiveStake();
        uint256 quorum = (totalStake * QUORUM_BPS) / 10_000;
        passed = block.timestamp > p.endTime
            && p.forVotes + p.againstVotes >= quorum
            && p.forVotes > p.againstVotes;
    }
}
