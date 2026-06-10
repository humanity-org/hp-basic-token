// test/Snapshot.ts
//
// Tests for the parallel, crash-resumable snapshot builder. Proves that:
//   - parallel execution produces byte-identical results to sequential
//   - a crashed run resumes from its checkpoint without refetching
//     completed work, and still produces the identical result
//   - checkpoints are locked to their run parameters
//   - transient RPC failures are retried, permanent ones abort the run

import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ignition, ethers } from "hardhat";
import HTokenModule from "../ignition/modules/HToken";
import { buildSnapshot } from "../scripts/lib/snapshot";

const BALANCE_OF = "0x70a08231";
const CHUNK = 4;

// Wraps a provider, counting getLogs and eth_call invocations and letting a
// test inject failures at exact call numbers to simulate crashes/flakiness.
function wrapProvider(
  real: any,
  hooks: {
    onGetLogs?: (count: number) => void;
    onCall?: (selector: string, count: number) => void;
  } = {}
) {
  let getLogsCount = 0;
  const callCounts: Record<string, number> = {};
  const provider = new Proxy(real, {
    get(target, prop) {
      if (prop === "getLogs") {
        return async (filter: any) => {
          getLogsCount++;
          hooks.onGetLogs?.(getLogsCount);
          return target.getLogs(filter);
        };
      }
      if (prop === "call") {
        return async (tx: any) => {
          const selector = (tx.data ?? "").slice(0, 10);
          callCounts[selector] = (callCounts[selector] ?? 0) + 1;
          hooks.onCall?.(selector, callCounts[selector]);
          return target.call(tx);
        };
      }
      const value = (target as any)[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return {
    provider,
    getLogsCount: () => getLogsCount,
    balanceOfCount: () => callCounts[BALANCE_OF] ?? 0,
  };
}

describe("Snapshot builder", function () {
  // Deploys a token and creates transfer history spread over many blocks,
  // ending with exactly 5 non-zero holders.
  async function setup() {
    const [owner, a, b, c, d, e] = await ethers.getSigners();
    const startBlock = await ethers.provider.getBlockNumber();
    const { hToken } = await ignition.deploy(HTokenModule, {
      parameters: { HTokenModule: { multisig: await owner.getAddress() } },
    });
    await hToken.mint(await a.getAddress(), ethers.parseEther("100"));
    await hToken.mint(await b.getAddress(), ethers.parseEther("20"));
    await hToken.mint(await c.getAddress(), ethers.parseEther("3"));
    await hToken.mint(await d.getAddress(), ethers.parseEther("0.7"));
    await hToken.mint(await e.getAddress(), ethers.parseEther("55"));
    await hToken.connect(a).transfer(await b.getAddress(), ethers.parseEther("1.5"));
    await hToken.connect(c).transfer(await d.getAddress(), ethers.parseEther("0.25"));
    await hToken.burn(await e.getAddress(), ethers.parseEther("5"));
    const snapshotBlock = await ethers.provider.getBlockNumber();
    // Post-snapshot noise the snapshot must ignore.
    await hToken.mint(await a.getAddress(), ethers.parseEther("1000"));

    const token = await hToken.getAddress();
    const baseOptions = { fromBlock: startBlock, chunkSize: CHUNK };
    const totalRanges = Math.ceil((snapshotBlock - startBlock + 1) / CHUNK);
    const reference = await buildSnapshot(ethers.provider, token, snapshotBlock, {
      ...baseOptions,
      concurrency: 1,
    });
    expect(reference.holderCount).to.equal(5);
    return { token, snapshotBlock, baseOptions, totalRanges, reference };
  }

  function tempCheckpoint(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-test-"));
    return path.join(dir, "checkpoint.json");
  }

  it("parallel execution matches the sequential result exactly", async function () {
    const { token, snapshotBlock, baseOptions, reference } = await setup();
    const parallel = await buildSnapshot(ethers.provider, token, snapshotBlock, {
      ...baseOptions,
      concurrency: 8,
    });
    expect(parallel).to.deep.equal(reference);
  });

  it("resumes the log scan from a checkpoint without refetching", async function () {
    const { token, snapshotBlock, baseOptions, totalRanges, reference } = await setup();
    const checkpointPath = tempCheckpoint();

    // Crash on the 3rd getLogs call. Sequential + checkpoint-every-commit
    // means exactly 2 ranges are committed before the crash.
    const crashing = wrapProvider(ethers.provider, {
      onGetLogs: (count) => {
        if (count === 3) throw new Error("simulated crash");
      },
    });
    await expect(
      buildSnapshot(crashing.provider, token, snapshotBlock, {
        ...baseOptions,
        concurrency: 1,
        retries: 0,
        checkpointPath,
        checkpointEvery: 1,
      })
    ).to.be.rejectedWith(/simulated crash/);

    // Resume with a healthy provider: only the remaining ranges are fetched.
    const counting = wrapProvider(ethers.provider);
    const resumed = await buildSnapshot(counting.provider, token, snapshotBlock, {
      ...baseOptions,
      concurrency: 4,
      checkpointPath,
      checkpointEvery: 1,
    });
    expect(counting.getLogsCount()).to.equal(totalRanges - 2);
    expect(resumed).to.deep.equal(reference);
  });

  it("resumes the cross-check from a checkpoint without rechecking", async function () {
    const { token, snapshotBlock, baseOptions, reference } = await setup();
    const checkpointPath = tempCheckpoint();

    // Crash on the 3rd balanceOf. Two holders are committed before the crash.
    const crashing = wrapProvider(ethers.provider, {
      onCall: (selector, count) => {
        if (selector === BALANCE_OF && count === 3) throw new Error("simulated crash");
      },
    });
    await expect(
      buildSnapshot(crashing.provider, token, snapshotBlock, {
        ...baseOptions,
        concurrency: 1,
        retries: 0,
        checkpointPath,
        checkpointEvery: 1,
      })
    ).to.be.rejectedWith(/simulated crash/);

    // Resume: the log scan is already complete (0 getLogs) and only the
    // remaining 3 of 5 holders are cross-checked.
    const counting = wrapProvider(ethers.provider);
    const resumed = await buildSnapshot(counting.provider, token, snapshotBlock, {
      ...baseOptions,
      concurrency: 4,
      checkpointPath,
      checkpointEvery: 1,
    });
    expect(counting.getLogsCount()).to.equal(0);
    expect(counting.balanceOfCount()).to.equal(reference.holderCount - 2);
    expect(resumed).to.deep.equal(reference);
  });

  it("refuses a checkpoint written by a run with different parameters", async function () {
    const { token, snapshotBlock, baseOptions } = await setup();
    const checkpointPath = tempCheckpoint();
    await buildSnapshot(ethers.provider, token, snapshotBlock, {
      ...baseOptions,
      checkpointPath,
    });
    await expect(
      buildSnapshot(ethers.provider, token, snapshotBlock - 1, {
        ...baseOptions,
        checkpointPath,
      })
    ).to.be.rejectedWith(/different run/);
  });

  it("retries transient RPC failures and still succeeds", async function () {
    const { token, snapshotBlock, baseOptions, reference } = await setup();
    let failures = 0;
    const flaky = wrapProvider(ethers.provider, {
      onGetLogs: () => {
        // The first two getLogs attempts fail, everything after succeeds.
        if (failures < 2) {
          failures++;
          throw new Error("transient failure");
        }
      },
    });
    const snapshot = await buildSnapshot(flaky.provider, token, snapshotBlock, {
      ...baseOptions,
      concurrency: 2,
      retries: 3,
      retryBaseDelayMs: 1,
    });
    expect(snapshot).to.deep.equal(reference);
  });

  it("aborts when failures exhaust the retry budget", async function () {
    const { token, snapshotBlock, baseOptions } = await setup();
    const broken = wrapProvider(ethers.provider, {
      onGetLogs: () => {
        throw new Error("permanent failure");
      },
    });
    await expect(
      buildSnapshot(broken.provider, token, snapshotBlock, {
        ...baseOptions,
        retries: 1,
        retryBaseDelayMs: 1,
      })
    ).to.be.rejectedWith(/permanent failure/);
  });
});
