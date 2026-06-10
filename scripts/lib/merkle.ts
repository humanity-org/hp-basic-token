// scripts/lib/merkle.ts
//
// Builds an OpenZeppelin StandardMerkleTree over (account, amount) allocations
// for the MerkleDistributor contract, and exports per-account proofs.
// The leaf encoding (double keccak256 of abi.encode(address, uint256)) matches
// the verification in contracts/MerkleDistributor.sol.

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

export interface DistributionTree {
  root: string;
  /// Checksummed address -> { amount, proof } for every allocation.
  claims: Record<string, { amount: string; proof: string[] }>;
}

/// Builds the Merkle tree from a holders map (address -> amount string).
export function buildTree(
  holders: Record<string, string>
): StandardMerkleTree<[string, string]> {
  const entries = Object.entries(holders).sort(([a], [b]) => (a < b ? -1 : 1));
  if (entries.length === 0) {
    throw new Error("cannot build a tree with no holders");
  }
  return StandardMerkleTree.of(
    entries.map(([address, amount]) => [address, amount] as [string, string]),
    ["address", "uint256"]
  );
}

/// Exports the root and a proof for every (account, amount) leaf.
export function exportClaims(
  tree: StandardMerkleTree<[string, string]>
): DistributionTree {
  const claims: Record<string, { amount: string; proof: string[] }> = {};
  for (const [index, [address, amount]] of tree.entries()) {
    claims[address] = { amount, proof: tree.getProof(index) };
  }
  return { root: tree.root, claims };
}

/// Rebuilds the tree from the same input and verifies the root matches.
/// Guards against non-determinism in tree construction.
export function verifyTreeDeterminism(
  holders: Record<string, string>,
  expectedRoot: string
): void {
  const rebuilt = buildTree(holders);
  if (rebuilt.root !== expectedRoot) {
    throw new Error(
      `tree determinism check failed: rebuilt root ${rebuilt.root} != expected ${expectedRoot}`
    );
  }
}
