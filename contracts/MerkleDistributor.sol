// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// Distributes an ERC20 token to a fixed set of (account, amount) allocations
/// committed to by a single immutable Merkle root. Each account can claim exactly once.
/// Leaves follow OpenZeppelin's StandardMerkleTree encoding:
/// keccak256(bytes.concat(keccak256(abi.encode(account, amount)))).
/// The owner has no power over the root or claims; it can only withdraw tokens
/// held by this contract (e.g. unclaimed allocations after the claim period).
contract MerkleDistributor is Ownable {
    using SafeERC20 for IERC20;

    /// @notice The token being distributed.
    IERC20 public immutable token;

    /// @notice The Merkle root committing to every (account, amount) allocation.
    bytes32 public immutable merkleRoot;

    /// @notice Whether an account has already claimed its allocation.
    mapping(address account => bool) public hasClaimed;

    event Claimed(address indexed account, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error AlreadyClaimed(address account);
    error InvalidProof();

    /// @param _token the ERC20 token to distribute.
    /// @param _merkleRoot the root of the allocation tree. Immutable after deployment.
    /// @param _initialOwner the owner allowed to withdraw tokens held by this contract.
    constructor(IERC20 _token, bytes32 _merkleRoot, address _initialOwner) Ownable(_initialOwner) {
        token = _token;
        merkleRoot = _merkleRoot;
    }

    /// @notice Claim the allocation for `_account`. Callable by anyone, but tokens are
    /// always sent to `_account`, so third-party calls can only help, not steal.
    /// @param _account the account whose allocation is claimed.
    /// @param _amount the exact allocated amount; must match the committed leaf.
    /// @param _proof the Merkle proof for the (account, amount) leaf.
    function claim(address _account, uint256 _amount, bytes32[] calldata _proof) external {
        if (hasClaimed[_account]) {
            revert AlreadyClaimed(_account);
        }
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(_account, _amount))));
        if (!MerkleProof.verify(_proof, merkleRoot, leaf)) {
            revert InvalidProof();
        }
        hasClaimed[_account] = true;
        token.safeTransfer(_account, _amount);
        emit Claimed(_account, _amount);
    }

    /// @notice Withdraw tokens held by this contract. Only the owner can call this.
    /// @param _to the address receiving the withdrawn tokens.
    /// @param _amount the amount to withdraw.
    function withdraw(address _to, uint256 _amount) external onlyOwner {
        token.safeTransfer(_to, _amount);
        emit Withdrawn(_to, _amount);
    }
}
