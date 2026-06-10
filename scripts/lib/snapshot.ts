// scripts/lib/snapshot.ts
//
// Builds a balance snapshot of an ERC20 token at a specific block.
// Balances are reconstructed from Transfer event logs, then verified two ways:
//   1. Conservation: the sum of all reconstructed balances must equal
//      totalSupply() at the snapshot block.
//   2. Cross-check: balanceOf() at the snapshot block is queried for every
//      holder and must match the reconstructed balance exactly.
// Any mismatch throws - a snapshot is either provably correct or it fails.

import { ethers } from "ethers";

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
  /// Cross-check balanceOf for every holder (default true). Disable only for
  /// very large holder sets where sampling is handled separately.
  crossCheckAll?: boolean;
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
  const log = options.log ?? (() => {});
  const excluded = new Set(
    (options.excludeAddresses ?? []).map((a) => ethers.getAddress(a))
  );

  // 1. Replay every Transfer event up to and including the snapshot block.
  const balances = new Map<string, bigint>();
  for (let start = fromBlock; start <= snapshotBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, snapshotBlock);
    const logs = await provider.getLogs({
      address: token,
      topics: [TRANSFER_TOPIC],
      fromBlock: start,
      toBlock: end,
    });
    for (const entry of logs) {
      // Transfer(address indexed from, address indexed to, uint256 value)
      const from = ethers.getAddress(ethers.dataSlice(entry.topics[1], 12));
      const to = ethers.getAddress(ethers.dataSlice(entry.topics[2], 12));
      const value = BigInt(entry.data);
      if (from !== ethers.ZeroAddress) {
        balances.set(from, (balances.get(from) ?? 0n) - value);
      }
      if (to !== ethers.ZeroAddress) {
        balances.set(to, (balances.get(to) ?? 0n) + value);
      }
    }
    log(`scanned blocks ${start}-${end}, ${balances.size} addresses seen`);
  }

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

  // 2. Conservation check against totalSupply at the snapshot block.
  const erc20 = new ethers.Contract(token, ERC20_ABI, provider);
  const totalSupply: bigint = await erc20.totalSupply({ blockTag: snapshotBlock });
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

  // 3. Cross-check every reconstructed balance against balanceOf at the block.
  if (options.crossCheckAll ?? true) {
    for (const [address, balance] of nonZero) {
      const onChain: bigint = await erc20.balanceOf(address, { blockTag: snapshotBlock });
      if (onChain !== balance) {
        throw new Error(
          `cross-check failed for ${address}: reconstructed ${balance}, on-chain ${onChain}`
        );
      }
    }
    log(`cross-check passed for all ${nonZero.size} holders`);
  }

  // 4. Split out excluded addresses. Their balances never enter the holder set.
  const holders: Record<string, string> = {};
  const excludedOut: Record<string, string> = {};
  let holdersTotal = 0n;
  let excludedTotal = 0n;
  for (const address of [...nonZero.keys()].sort()) {
    const balance = nonZero.get(address)!;
    if (excluded.has(address)) {
      excludedOut[address] = balance.toString();
      excludedTotal += balance;
    } else {
      holders[address] = balance.toString();
      holdersTotal += balance;
    }
  }

  return {
    token,
    block: snapshotBlock,
    totalSupply: totalSupply.toString(),
    holdersTotal: holdersTotal.toString(),
    excludedTotal: excludedTotal.toString(),
    holderCount: Object.keys(holders).length,
    holders,
    excluded: excludedOut,
  };
}
