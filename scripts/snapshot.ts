// scripts/snapshot.ts
//
// CLI for building a token balance snapshot at a fixed block.
// Run with: npx hardhat run scripts/snapshot.ts --network <network>
//
// Environment variables:
//   SNAPSHOT_TOKEN       token (proxy) address to snapshot           [required]
//   SNAPSHOT_BLOCK       block number to snapshot at                 [required]
//   SNAPSHOT_FROM_BLOCK  first block to scan logs from               (default 0)
//   SNAPSHOT_EXCLUSIONS  path to a JSON file with an array of
//                        addresses to exclude from the holder set    (optional)
//   SNAPSHOT_OUT         output path (default distribution-data/snapshot-<block>.json)
//   SNAPSHOT_CONCURRENCY concurrent RPC requests                     (default 8)
//   SNAPSHOT_CHECKPOINT  checkpoint path for crash-safe resume
//                        (default distribution-data/checkpoint-<block>.json)
//
// The output and any exclusion files live under distribution-data/, which is
// gitignored: distribution inputs are working data, never committed.

import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";
import { buildSnapshot } from "./lib/snapshot";

async function main() {
  const token = process.env.SNAPSHOT_TOKEN;
  const block = process.env.SNAPSHOT_BLOCK;
  if (!token || !block) {
    throw new Error("SNAPSHOT_TOKEN and SNAPSHOT_BLOCK are required");
  }
  const snapshotBlock = parseInt(block, 10);
  const fromBlock = parseInt(process.env.SNAPSHOT_FROM_BLOCK ?? "0", 10);

  let excludeAddresses: string[] = [];
  if (process.env.SNAPSHOT_EXCLUSIONS) {
    excludeAddresses = JSON.parse(
      fs.readFileSync(process.env.SNAPSHOT_EXCLUSIONS, "utf8")
    );
  }

  const checkpointPath =
    process.env.SNAPSHOT_CHECKPOINT ??
    path.join("distribution-data", `checkpoint-${snapshotBlock}.json`);

  const snapshot = await buildSnapshot(ethers.provider, token, snapshotBlock, {
    fromBlock,
    excludeAddresses,
    concurrency: parseInt(process.env.SNAPSHOT_CONCURRENCY ?? "8", 10),
    checkpointPath,
    log: console.log,
  });

  const out =
    process.env.SNAPSHOT_OUT ??
    path.join("distribution-data", `snapshot-${snapshotBlock}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");

  console.log(`snapshot written to ${out}`);
  console.log(`  holders:        ${snapshot.holderCount}`);
  console.log(`  holders total:  ${snapshot.holdersTotal}`);
  console.log(`  excluded total: ${snapshot.excludedTotal}`);
  console.log(`  total supply:   ${snapshot.totalSupply}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
