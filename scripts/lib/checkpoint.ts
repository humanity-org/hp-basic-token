// scripts/lib/checkpoint.ts
//
// Crash-safe progress checkpoints for the snapshot builder. The checkpoint
// stores the contiguous prefix of completed work (blocks scanned, holders
// cross-checked) plus the reconstructed balances, and is written atomically
// (temp file + rename) so a crash can never leave a half-written file.
// A checkpoint is bound to its run parameters: resuming with different
// parameters is refused instead of silently mixing two runs.

import * as fs from "fs";
import * as path from "path";

export interface Checkpoint {
  /// Identifies the run parameters this checkpoint belongs to.
  paramsKey: string;
  /// Last block whose Transfer logs are fully applied to `balances`.
  scannedThrough: number;
  /// Number of holders (in sorted address order) already cross-checked.
  checkedThrough: number;
  /// Reconstructed balances so far: address -> amount (decimal string).
  balances: Record<string, string>;
}

export function loadCheckpoint(
  filePath: string,
  paramsKey: string
): Checkpoint | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const checkpoint: Checkpoint = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (checkpoint.paramsKey !== paramsKey) {
    throw new Error(
      `checkpoint ${filePath} belongs to a different run ` +
        `(${checkpoint.paramsKey} != ${paramsKey}); ` +
        `delete it or use a different checkpoint path`
    );
  }
  return checkpoint;
}

export function saveCheckpoint(filePath: string, checkpoint: Checkpoint): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(checkpoint));
  fs.renameSync(tempPath, filePath);
}
