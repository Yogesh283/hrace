// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RaceMultiSig
 * @notice Fixed 3-of-5 multisig for treasury and governance operations (whitepaper Page 19, 35, 45).
 * @dev Signers and threshold are immutable after construction (no add/remove/replace, no threshold change).
 *      Submit → confirm (idempotent per signer) → auto-execute at 3 confirmations.
 *      Not a Gnosis Safe; no module/guard framework.
 */
contract RaceMultiSig is ReentrancyGuard {

    /// @notice Fixed approval threshold (3-of-5).
    uint256 public constant REQUIRED = 3;
    uint256 public constant SIGNER_COUNT = 5;

    address[5] public signers;
    mapping(address => bool) public isSigner;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
        mapping(address => bool) confirmed;
    }

    Transaction[] private _transactions;

    event Deposit(address indexed sender, uint256 amount);
    event Submission(uint256 indexed txId);
    event Confirmation(address indexed signer, uint256 indexed txId);
    event Execution(uint256 indexed txId);
    event ExecutionFailure(uint256 indexed txId);

    modifier onlySigner() {
        require(isSigner[msg.sender], "RaceMultiSig: not signer");
        _;
    }

    constructor(address[5] memory signers_) {
        uint256 count;
        for (uint256 i = 0; i < 5; i++) {
            address s = signers_[i];
            require(s != address(0), "RaceMultiSig: zero signer");
            require(!isSigner[s], "RaceMultiSig: duplicate");
            signers[i] = s;
            isSigner[s] = true;
            unchecked {
                ++count;
            }
        }
        require(count == SIGNER_COUNT, "RaceMultiSig: need 5");
    }

    /// @notice Same as REQUIRED — kept for deploy/UI clarity.
    function threshold() external pure returns (uint256) {
        return REQUIRED;
    }

    function getSigners() external view returns (address[5] memory) {
        return signers;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submitTransaction(address to, uint256 value, bytes calldata data)
        external
        onlySigner
        returns (uint256 txId)
    {
        require(to != address(0) || data.length > 0, "RaceMultiSig: invalid tx");
        txId = _transactions.length;
        _transactions.push();
        Transaction storage txn = _transactions[txId];
        txn.to = to;
        txn.value = value;
        txn.data = data;
        emit Submission(txId);
    }

    /// @notice Confirm a pending tx. At REQUIRED confirmations, executes immediately (reentrancy-guarded).
    function confirmTransaction(uint256 txId) external onlySigner nonReentrant {
        require(txId < _transactions.length, "RaceMultiSig: bad id");
        Transaction storage txn = _transactions[txId];
        require(!txn.executed, "RaceMultiSig: executed");
        require(!txn.confirmed[msg.sender], "RaceMultiSig: confirmed");

        txn.confirmed[msg.sender] = true;
        unchecked {
            txn.confirmations += 1;
        }
        emit Confirmation(msg.sender, txId);

        if (txn.confirmations >= REQUIRED) {
            _executeTransaction(txId);
        }
    }

    function executeTransaction(uint256 txId) external onlySigner nonReentrant {
        require(txId < _transactions.length, "RaceMultiSig: bad id");
        Transaction storage txn = _transactions[txId];
        require(!txn.executed, "RaceMultiSig: executed");
        require(txn.confirmations >= REQUIRED, "RaceMultiSig: not confirmed");
        _executeTransaction(txId);
    }

    function transactionCount() external view returns (uint256) {
        return _transactions.length;
    }

    function getTransaction(uint256 txId)
        external
        view
        returns (address to, uint256 value, bytes memory data, bool executed, uint256 confirmations)
    {
        require(txId < _transactions.length, "RaceMultiSig: bad id");
        Transaction storage txn = _transactions[txId];
        return (txn.to, txn.value, txn.data, txn.executed, txn.confirmations);
    }

    function isConfirmed(uint256 txId, address signer) external view returns (bool) {
        require(txId < _transactions.length, "RaceMultiSig: bad id");
        return _transactions[txId].confirmed[signer];
    }

    function _executeTransaction(uint256 txId) private {
        Transaction storage txn = _transactions[txId];
        require(!txn.executed, "RaceMultiSig: executed");
        txn.executed = true;

        (bool ok, bytes memory returndata) = txn.to.call{value: txn.value}(txn.data);
        if (!ok) {
            emit ExecutionFailure(txId);
            if (returndata.length > 0) {
                assembly {
                    revert(add(returndata, 32), mload(returndata))
                }
            }
            revert("RaceMultiSig: call failed");
        }
        emit Execution(txId);
    }
}
