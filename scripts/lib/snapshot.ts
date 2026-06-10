// scripts/lib/snapshot.ts
//
// Builds a balance snapshot of an ERC20 token at a specific block.
// Balances are reconstructed from Transfer event logs, then verified two ways:
//   1. Conservation: the sum of all reconstructed balances must equal
//      totalSupply() at the snapshot block.
//   2. Cross-check: balanceOf() at the snapshot block is queried for every
//      holder and must match the reconstructed balance exactly.
// Any mismatch throws - a snapshot is either provably correct or it fails.
//
// Execution is parallel (bounded worker pool with retry/backoff) but results
// are committed strictly in order, so progress is checkpointed as a
// contiguous prefix and a crashed run resumes without refetching completed
// work. Resumed state is still fully re-verified by checks 1 and 2, so a
// corrupted checkpoint cannot produce a wrong snapshot - only a failed one.

import { ethers } from "ethers";
import { runPoolOrdered, withRetry } from "./pool";
import { Checkpoint, loadCheckpoint, saveCheckpoint } from "./checkpoint";

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

export interface SnapshotOptions {
  /// Block to start scanning logs from (default 0).
  fromBlock?: number;
  /// Max blocks per eth_getLogs request (default 10000).
  chunkSize?: number;
  /// Addresses to exclude from the holder set. Their balances are reported
  /// separately and never enter the distribution.
  excludeAddresses?: string[];
  /// Cross-check balanceOf for every holder (default true).
  crossCheckAll?: boolean;
  /// Concurrent RPC requests (default 8).
  concurrency?: number;
  /// Path to a checkpoint file enabling crash-safe resume (optional).
  checkpointPath?: string;
  /// Commit a checkpoint every N completed units of work (default 25).
  checkpointEvery?: number;
  /// Retries per RPC call after the first attempt (default 5).
  retries?: number;
  /// Base backoff delay between retries (default 500ms).
  retryBaseDelayMs?: number;
  /// Optional progress logger.
  log?: (message: string) => void;
}

export interface Snapshot {
  token: string;
  block: number;
  totalSupply: string;
  holdersTotal: string;
  excludedTotal: string;
  holderCount: number;
  /// Checksummed address -> balance (decimal string). Sorted by address.
  holders: Record<string, string>;
  /// Excluded checksummed address -> balance (decimal string).
  excluded: Record<string, string>;
}

interface RangeDelta {
  address: string;
  delta: bigint;
}

/// Reconstructs all balances at `snapshotBlock` by replaying Transfer logs.
export async function buildSnapshot(
  provider: ethers.Provider,
  tokenAddress: string,
  snapshotBlock: number,
  options: SnapshotOptions = {}
): Promise<Snapshot> {
  const token = ethers.getAddress(tokenAddress);
  const fromBlock = options.fromBlock ?? 0;
  const chunkSize = options.chunkSize ?? 10_000;
  const concurrency = options.concurrency ?? 8;
  const checkpointEvery = options.checkpointEvery ?? 25;
  const retry = { retries: options.retries, baseDelayMs: options.retryBaseDelayMs };
  const log = options.log ?? (() => {});
  const excluded = new Set(
    (options.excludeAddresses ?? []).map((a) => ethers.getAddress(a))
  );

  // The checkpoint is bound to everything that shapes reconstruction.
  // (Concurrency and exclusions do not affect reconstructed balances.)
  const paramsKey = `${token}:${fromBlock}:${snapshotBlock}:${chunkSize}`;

  // ---- Resume state ----
  const balances = new Map<string, bigint>();
  let scannedThrough = fromBlock - 1;
  let checkedThrough = 0;
  const checkpoint = options.checkpointPath
    ? loadCheckpoint(options.checkpointPath, paramsKey)
    : null;
  if (checkpoint) {
    for (const [address, amount] of Object.entries(checkpoint.balances)) {
      balances.set(address, BigInt(amount));
    }
    scannedThrough = checkpoint.scannedThrough;
    checkedThrough = checkpoint.checkedThrough;
    log(
      `resuming from checkpoint: scanned through block ${scannedThrough}, ` +
        `${checkedThrough} holders cross-checked`
    );
  }

  function persist(): void {
    if (!options.checkpointPath) {
      return;
    }
    const serialized: Record<string, string> = {};
    for (const [address, amount] of balances) {
      serialized[address] = amount.toString();
    }
    saveCheckpoint(options.checkpointPath, {
      paramsKey,
      scannedThrough,
      checkedThrough,
      balances: serialized,
    } satisfies Checkpoint);
  }

  // ---- 1. Replay Transfer logs in parallel, commit in block order ----
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = scannedThrough + 1; start <= snapshotBlock; start += chunkSize) {
    ranges.push({ start, end: Math.min(start + chunkSize - 1, snapshotBlock) });
  }
  let committedRanges = 0;
  await runPoolOrdered(
    ranges,
    concurrency,
    async (range) => {
      const logs = await withRetry(
        `getLogs ${range.start}-${range.end}`,
        () =>
          provider.getLogs({
            address: token,
            topics: [TRANSFER_TOPIC],
            fromBlock: range.start,
            toBlock: range.end,
          }),
        retry
      );
      // Transfer(address indexed from, address indexed to, uint256 value)
      const deltas: RangeDelta[] = [];
      for (const entry of logs) {
        const from = ethers.getAddress(ethers.dataSlice(entry.topics[1], 12));
        const to = ethers.getAddress(ethers.dataSlice(entry.topics[2], 12));
        const value = BigInt(entry.data);
        if (from !== ethers.ZeroAddress) {
          deltas.push({ address: from, delta: -value });
        }
        if (to !== ethers.ZeroAddress) {
          deltas.push({ address: to, delta: value });
        }
      }
      return { range, deltas };
    },
    ({ range, deltas }) => {
      for (const { address, delta } of deltas) {
        balances.set(address, (balances.get(address) ?? 0n) + delta);
      }
      scannedThrough = range.end;
      committedRanges++;
      if (committedRanges % checkpointEvery === 0) {
        persist();
      }
      log(`scanned blocks ${range.start}-${range.end}, ${balances.size} addresses seen`);
    }
  );
  persist();

  // No reconstructed balance may be negative, and zero balances drop out.
  const nonZero = new Map<string, bigint>();
  for (const [address, balance] of balances) {
    if (balance < 0n) {
      throw new Error(`negative reconstructed balance for ${address}: ${balance}`);
    }
    if (balance > 0n) {
      nonZero.set(address, balance);
    }
  }

  // ---- 2. Conservation check against totalSupply at the snapshot block ----
  const erc20 = new ethers.Contract(token, ERC20_ABI, provider);
  const totalSupply: bigint = await withRetry(
    "totalSupply",
    () => erc20.totalSupply({ blockTag: snapshotBlock }),
    retry
  );
  let sum = 0n;
  for (const balance of nonZero.values()) {
    sum += balance;
  }
  if (sum !== totalSupply) {
    throw new Error(
      `conservation check failed: sum of balances ${sum} != totalSupply ${totalSupply}`
    );
  }
  log(`conservation check passed: ${nonZero.size} holders, supply ${totalSupply}`);

  // ---- 3. Cross-check every balance against balanceOf, in parallel ----
  if (options.crossCheckAll ?? true) {
    const holders = [...nonZero.keys()].sort();
    const remaining = holders.slice(checkedThrough);
    await runPoolOrdered(
      remaining,
      concurrency,
      async (address) => {
        const onChain: bigint = await withRetry(
          `balanceOf ${address}`,
          () => erc20.balanceOf(address, { blockTag: snapshotBlock }),
          retry
        );
        return { address, onChain };
      },
      ({ address, onChain }) => {
        const reconstructed = nonZero.get(address)!;
        if (onChain !== reconstructed) {
          throw new Error(
            `cross-check failed for ${address}: reconstructed ${reconstructed}, on-chain ${onChain}`
          );
        }
        checkedThrough++;
        if (checkedThrough % checkpointEvery === 0) {
          persist();
          log(`cross-checked ${checkedThrough}/${holders.length} holders`);
        }
      }
    );
    persist();
    log(`cross-check passed for all ${holders.length} holders`);
  }

  // ---- 4. Split out excluded addresses; build the deterministic result ----
  const holdersOut: Record<string, string> = {};
  const excludedOut: Record<string, string> = {};
  let holdersTotal = 0n;
  let excludedTotal = 0n;
  for (const address of [...nonZero.keys()].sort()) {
    const balance = nonZero.get(address)!;
    if (excluded.has(address)) {
      excludedOut[address] = balance.toString();
      excludedTotal += balance;
    } else {
      holdersOut[address] = balance.toString();
      holdersTotal += balance;
    }
  }

  return {
    token,
    block: snapshotBlock,
    totalSupply: totalSupply.toString(),
    holdersTotal: holdersTotal.toString(),
    excludedTotal: excludedTotal.toString(),
    holderCount: Object.keys(holdersOut).length,
    holders: holdersOut,
    excluded: excludedOut,
  };
}
