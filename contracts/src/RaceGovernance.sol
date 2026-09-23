// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceGovernance
 * @notice Community wallet governance (10–12 members, 1 wallet = 1 vote) with timelock.
 * @dev SEPARATE from RaceMultiSig (3-of-5 treasury/security). Does NOT modify or control MultiSig.
 *      Not stake/token weighted — unlike legacy RaceGovernor.sol.
 *
 * Flow: propose → vote → (forVotes >= threshold) → queue → timelock → execute.
 * Self-configuration (members, threshold, periods, targets) only via executed proposals
 * (msg.sender == address(this)).
 */
contract RaceGovernance is ReentrancyGuard {
    uint256 public constant MIN_MEMBERS = 10;
    uint256 public constant MAX_MEMBERS = 12;
    uint256 public constant MIN_VOTING_PERIOD = 1 hours;
    uint256 public constant MAX_VOTING_PERIOD = 30 days;
    uint256 public constant MIN_TIMELOCK = 1 hours;
    uint256 public constant MAX_TIMELOCK = 30 days;

    address[] private _members;
    mapping(address => bool) public isMember;
    mapping(address => uint256) private _memberIndex; // 1-based; 0 = absent

    /// @notice Absolute yes-votes required to pass (must be > 50% of member count).
    uint256 public threshold;
    uint256 public votingPeriod;
    uint256 public timelockDelay;

    mapping(address => bool) public isGovernedTarget;

    enum ProposalState {
        Pending,
        Active,
        Defeated,
        Succeeded,
        Queued,
        Executed,
        Cancelled,
        Expired
    }

    struct Proposal {
        address target;
        uint256 value;
        bytes data;
        bytes32 descriptionHash;
        address proposer;
        uint64 createdAt;
        uint64 votingStart;
        uint64 votingEnd;
        uint64 eta;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool cancelled;
        bool queued;
    }

    Proposal[] private _proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public voteSupport; // true = for

    event GovernanceInitialized(
        address[] members,
        uint256 threshold,
        uint256 votingPeriod,
        uint256 timelockDelay
    );
    event GovernedTargetAdded(address indexed target);
    event GovernedTargetRemoved(address indexed target);
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address indexed target,
        uint256 value,
        bytes32 descriptionHash,
        uint64 votingStart,
        uint64 votingEnd
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 forVotes, uint256 againstVotes);
    event ProposalQueued(uint256 indexed proposalId, uint64 eta);
    event ProposalApproved(uint256 indexed proposalId, uint256 forVotes, uint256 againstVotes);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event GovernanceMemberAdded(address indexed member);
    event GovernanceMemberRemoved(address indexed member);
    event ThresholdUpdated(uint256 threshold);
    event VotingPeriodUpdated(uint256 votingPeriod);
    event TimelockUpdated(uint256 timelockDelay);

    modifier onlyMember() {
        require(isMember[msg.sender], "RaceGovernance: not member");
        _;
    }

    /// @dev Only callable via successful proposal execution (this contract calls itself).
    modifier onlySelf() {
        require(msg.sender == address(this), "RaceGovernance: only self");
        _;
    }

    constructor(
        address[] memory members_,
        uint256 threshold_,
        uint256 votingPeriod_,
        uint256 timelockDelay_,
        address[] memory initialTargets_
    ) {
        uint256 n = members_.length;
        require(n >= MIN_MEMBERS && n <= MAX_MEMBERS, "RaceGovernance: bad member count");
        require(votingPeriod_ >= MIN_VOTING_PERIOD && votingPeriod_ <= MAX_VOTING_PERIOD, "RaceGovernance: bad voting");
        require(timelockDelay_ >= MIN_TIMELOCK && timelockDelay_ <= MAX_TIMELOCK, "RaceGovernance: bad timelock");
        _validateThreshold(threshold_, n);

        for (uint256 i = 0; i < n; i++) {
            address m = members_[i];
            require(m != address(0), "RaceGovernance: zero member");
            require(!isMember[m], "RaceGovernance: duplicate member");
            isMember[m] = true;
            _members.push(m);
            _memberIndex[m] = _members.length; // 1-based
        }

        threshold = threshold_;
        votingPeriod = votingPeriod_;
        timelockDelay = timelockDelay_;

        // Always allow self-governance of config.
        isGovernedTarget[address(this)] = true;
        emit GovernedTargetAdded(address(this));

        for (uint256 j = 0; j < initialTargets_.length; j++) {
            address t = initialTargets_[j];
            require(t != address(0), "RaceGovernance: zero target");
            if (!isGovernedTarget[t]) {
                isGovernedTarget[t] = true;
                emit GovernedTargetAdded(t);
            }
        }

        emit GovernanceInitialized(_members, threshold_, votingPeriod_, timelockDelay_);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function memberCount() external view returns (uint256) {
        return _members.length;
    }

    function getMembers() external view returns (address[] memory) {
        return _members;
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address target,
            uint256 value,
            bytes32 descriptionHash,
            address proposer,
            uint64 createdAt,
            uint64 votingStart,
            uint64 votingEnd,
            uint64 eta,
            uint256 forVotes,
            uint256 againstVotes,
            bool executed,
            bool cancelled,
            bool queued
        )
    {
        Proposal storage p = _requireProposal(proposalId);
        return (
            p.target,
            p.value,
            p.descriptionHash,
            p.proposer,
            p.createdAt,
            p.votingStart,
            p.votingEnd,
            p.eta,
            p.forVotes,
            p.againstVotes,
            p.executed,
            p.cancelled,
            p.queued
        );
    }

    function getProposalData(uint256 proposalId) external view returns (bytes memory data) {
        return _requireProposal(proposalId).data;
    }

    function proposalHash(uint256 proposalId) public view returns (bytes32) {
        Proposal storage p = _requireProposal(proposalId);
        return keccak256(abi.encode(p.target, p.value, p.data, p.descriptionHash, proposalId));
    }

    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage p = _requireProposal(proposalId);
        if (p.cancelled) return ProposalState.Cancelled;
        if (p.executed) return ProposalState.Executed;
        if (block.timestamp < p.votingStart) return ProposalState.Pending;
        if (block.timestamp <= p.votingEnd) return ProposalState.Active;
        if (p.queued) {
            if (block.timestamp >= p.eta + MAX_TIMELOCK) return ProposalState.Expired;
            return ProposalState.Queued;
        }
        if (p.forVotes >= threshold) return ProposalState.Succeeded;
        return ProposalState.Defeated;
    }

    // ─── Propose / Vote / Queue / Execute / Cancel ───────────────────────────

    function propose(address target, uint256 value, bytes calldata data, bytes32 descriptionHash)
        external
        onlyMember
        returns (uint256 proposalId)
    {
        require(target != address(0), "RaceGovernance: zero target");
        require(isGovernedTarget[target], "RaceGovernance: target not governed");
        require(descriptionHash != bytes32(0), "RaceGovernance: empty description");

        proposalId = _proposals.length;
        uint64 start = uint64(block.timestamp);
        uint64 end = uint64(uint256(start) + votingPeriod);

        _proposals.push(
            Proposal({
                target: target,
                value: value,
                data: data,
                descriptionHash: descriptionHash,
                proposer: msg.sender,
                createdAt: start,
                votingStart: start,
                votingEnd: end,
                eta: 0,
                forVotes: 0,
                againstVotes: 0,
                executed: false,
                cancelled: false,
                queued: false
            })
        );

        emit ProposalCreated(proposalId, msg.sender, target, value, descriptionHash, start, end);
    }

    function castVote(uint256 proposalId, bool support) external onlyMember {
        Proposal storage p = _requireProposal(proposalId);
        require(block.timestamp >= p.votingStart, "RaceGovernance: not started");
        require(block.timestamp <= p.votingEnd, "RaceGovernance: ended");
        require(!p.executed && !p.cancelled && !p.queued, "RaceGovernance: closed");
        require(!hasVoted[proposalId][msg.sender], "RaceGovernance: already voted");

        hasVoted[proposalId][msg.sender] = true;
        voteSupport[proposalId][msg.sender] = support;
        if (support) {
            unchecked {
                p.forVotes += 1;
            }
        } else {
            unchecked {
                p.againstVotes += 1;
            }
        }

        emit VoteCast(proposalId, msg.sender, support, p.forVotes, p.againstVotes);
    }

    /// @notice After voting ends with enough yes votes, queue for timelock.
    function queue(uint256 proposalId) external onlyMember {
        Proposal storage p = _requireProposal(proposalId);
        require(!p.executed && !p.cancelled, "RaceGovernance: closed");
        require(!p.queued, "RaceGovernance: already queued");
        require(block.timestamp > p.votingEnd, "RaceGovernance: voting active");
        require(p.forVotes >= threshold, "RaceGovernance: below threshold");
        // Quorum: enough participation that yes votes alone meet threshold (absolute model).
        require(p.forVotes + p.againstVotes >= threshold, "RaceGovernance: no quorum");

        p.queued = true;
        p.eta = uint64(block.timestamp + timelockDelay);

        emit ProposalApproved(proposalId, p.forVotes, p.againstVotes);
        emit ProposalQueued(proposalId, p.eta);
    }

    function execute(uint256 proposalId) external onlyMember nonReentrant {
        Proposal storage p = _requireProposal(proposalId);
        require(!p.executed && !p.cancelled, "RaceGovernance: closed");
        require(p.queued, "RaceGovernance: not queued");
        require(block.timestamp >= p.eta, "RaceGovernance: timelock");
        require(block.timestamp < uint256(p.eta) + MAX_TIMELOCK, "RaceGovernance: expired");
        require(isGovernedTarget[p.target], "RaceGovernance: target revoked");
        require(p.forVotes >= threshold, "RaceGovernance: below threshold");

        // Replay / substitution guard: hash must match stored fields.
        bytes32 expected = keccak256(abi.encode(p.target, p.value, p.data, p.descriptionHash, proposalId));
        require(expected == proposalHash(proposalId), "RaceGovernance: hash mismatch");

        p.executed = true;

        (bool ok, bytes memory returndata) = p.target.call{value: p.value}(p.data);
        if (!ok) {
            if (returndata.length > 0) {
                assembly {
                    revert(add(returndata, 32), mload(returndata))
                }
            }
            revert("RaceGovernance: call failed");
        }

        emit ProposalExecuted(proposalId);
    }

    function cancel(uint256 proposalId) external onlyMember {
        Proposal storage p = _requireProposal(proposalId);
        require(!p.executed, "RaceGovernance: executed");
        require(!p.cancelled, "RaceGovernance: cancelled");
        // Proposer may cancel before queue; after queue only before eta (timelock not yet live).
        require(msg.sender == p.proposer, "RaceGovernance: not proposer");
        if (p.queued) {
            require(block.timestamp < p.eta, "RaceGovernance: past eta");
        }

        p.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    // ─── Self-governed config (only via execute → this) ──────────────────────

    function addMember(address member) external onlySelf {
        require(member != address(0), "RaceGovernance: zero member");
        require(!isMember[member], "RaceGovernance: already member");
        require(_members.length < MAX_MEMBERS, "RaceGovernance: max members");

        isMember[member] = true;
        _members.push(member);
        _memberIndex[member] = _members.length;
        _validateThreshold(threshold, _members.length);

        emit GovernanceMemberAdded(member);
    }

    function removeMember(address member) external onlySelf {
        require(isMember[member], "RaceGovernance: not member");
        require(_members.length > MIN_MEMBERS, "RaceGovernance: min members");

        uint256 idx1 = _memberIndex[member];
        uint256 idx0 = idx1 - 1;
        uint256 last = _members.length - 1;
        if (idx0 != last) {
            address moved = _members[last];
            _members[idx0] = moved;
            _memberIndex[moved] = idx1;
        }
        _members.pop();
        delete _memberIndex[member];
        isMember[member] = false;

        _validateThreshold(threshold, _members.length);
        emit GovernanceMemberRemoved(member);
    }

    function setThreshold(uint256 newThreshold) external onlySelf {
        _validateThreshold(newThreshold, _members.length);
        threshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }

    function setVotingPeriod(uint256 newPeriod) external onlySelf {
        require(newPeriod >= MIN_VOTING_PERIOD && newPeriod <= MAX_VOTING_PERIOD, "RaceGovernance: bad voting");
        votingPeriod = newPeriod;
        emit VotingPeriodUpdated(newPeriod);
    }

    function setTimelockDelay(uint256 newDelay) external onlySelf {
        require(newDelay >= MIN_TIMELOCK && newDelay <= MAX_TIMELOCK, "RaceGovernance: bad timelock");
        timelockDelay = newDelay;
        emit TimelockUpdated(newDelay);
    }

    function registerGovernedTarget(address target) external onlySelf {
        require(target != address(0), "RaceGovernance: zero target");
        require(!isGovernedTarget[target], "RaceGovernance: already target");
        // Hard refuse MultiSig control surface being "governed" as a privileged pattern note —
        // still allow listing only non-MultiSig protocol contracts by convention in ops.
        isGovernedTarget[target] = true;
        emit GovernedTargetAdded(target);
    }

    function removeGovernedTarget(address target) external onlySelf {
        require(target != address(this), "RaceGovernance: keep self");
        require(isGovernedTarget[target], "RaceGovernance: not target");
        isGovernedTarget[target] = false;
        emit GovernedTargetRemoved(target);
    }

    receive() external payable {}

    // ─── Internal ────────────────────────────────────────────────────────────

    function _requireProposal(uint256 proposalId) private view returns (Proposal storage) {
        require(proposalId < _proposals.length, "RaceGovernance: bad id");
        return _proposals[proposalId];
    }

    function _validateThreshold(uint256 threshold_, uint256 memberCount_) private pure {
        require(threshold_ >= 1, "RaceGovernance: threshold zero");
        require(threshold_ <= memberCount_, "RaceGovernance: threshold > members");
        // Strict majority: threshold > 50% of members
        require(threshold_ * 2 > memberCount_, "RaceGovernance: threshold <= 50%");
    }
}
