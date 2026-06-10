// scripts/lib/pool.ts
//
// Concurrency utilities for RPC-heavy scripts:
//   withRetry       - retries a failing async call with exponential backoff.
//                     After the final attempt it throws; failures are never
//                     swallowed or skipped.
//   runPoolOrdered  - runs a worker over items with bounded concurrency, but
//                     delivers results to `commit` strictly in item order.
//                     This lets callers checkpoint a contiguous prefix of
//                     completed work even though execution is parallel.

export interface RetryOptions {
  /// Number of retries after the first attempt (default 5).
  retries?: number;
  /// Base delay before the first retry; doubles each attempt (default 500ms).
  baseDelayMs?: number;
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      // Exponential backoff with jitter to avoid thundering-herd retries.
      const delay = baseDelayMs * 2 ** attempt * (0.5 + Math.random() / 2);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`${label} failed after ${retries + 1} attempt(s): ${lastError}`);
}

export async function runPoolOrdered<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  commit: (result: R, index: number) => Promise<void> | void
): Promise<void> {
  const results = new Map<number, R>();
  let nextToStart = 0;
  let nextToCommit = 0;
  let failure: unknown = null;
  // Commits are serialized through a promise chain so that exactly one
  // drain runs at a time and every buffered result is eventually committed.
  let commitChain: Promise<void> = Promise.resolve();

  function scheduleDrain(): Promise<void> {
    commitChain = commitChain.then(async () => {
      while (!failure && results.has(nextToCommit)) {
        const index = nextToCommit;
        await commit(results.get(index)!, index);
        results.delete(index);
        nextToCommit++;
      }
    });
    return commitChain;
  }

  async function runWorker(): Promise<void> {
    while (true) {
      if (failure) {
        return;
      }
      const index = nextToStart++;
      if (index >= items.length) {
        return;
      }
      try {
        const result = await worker(items[index], index);
        results.set(index, result);
        await scheduleDrain();
      } catch (error) {
        failure = failure ?? error;
        return;
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  if (failure) {
    throw failure;
  }
}
