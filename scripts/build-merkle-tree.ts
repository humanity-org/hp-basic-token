// scripts/build-merkle-tree.ts
//
// CLI for building the distribution Merkle tree from a snapshot file
// produced by scripts/snapshot.ts.
// Run with: npx ts-node scripts/build-merkle-tree.ts  (or hardhat run)
//
// Environment variables:
//   TREE_SNAPSHOT  path to the snapshot JSON                          [required]
//   TREE_OUT       output path (default distribution-data/tree-<block>.json)
//
// Output contains the root and a proof per account, ready for claim
// submission against the MerkleDistributor. The root is rebuilt from the
// input a second time to guard against non-determinism.

import * as fs from "fs";
import * as path from "path";
import { buildTree, exportClaims, verifyTreeDeterminism } from "./lib/merkle";
import type { Snapshot } from "./lib/snapshot";

async function main() {
  const snapshotPath = process.env.TREE_SNAPSHOT;
  if (!snapshotPath) {
    throw new Error("TREE_SNAPSHOT is required");
  }
  const snapshot: Snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));

  const tree = buildTree(snapshot.holders);
  verifyTreeDeterminism(snapshot.holders, tree.root);
  const claims = exportClaims(tree);

  // The sum of all claims must equal the snapshot's holders total.
  let claimsTotal = 0n;
  for (const claim of Object.values(claims.claims)) {
    claimsTotal += BigInt(claim.amount);
  }
  if (claimsTotal !== BigInt(snapshot.holdersTotal)) {
    throw new Error(
      `claims total ${claimsTotal} != snapshot holders total ${snapshot.holdersTotal}`
    );
  }

  const out =
    process.env.TREE_OUT ??
    path.join("distribution-data", `tree-${snapshot.block}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      { token: snapshot.token, block: snapshot.block, ...claims },
      null,
      2
    ) + "\n"
  );

  console.log(`tree written to ${out}`);
  console.log(`  root:         ${claims.root}`);
  console.log(`  claims:       ${Object.keys(claims.claims).length}`);
  console.log(`  claims total: ${claimsTotal}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
