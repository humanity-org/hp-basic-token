# Deployment & Distribution Runbook

Step-by-step operator sequence for deploying the token and distributing
allocations. Every step states the command, the expected result, and how to
verify it before moving on. Component details: [distribution.md](distribution.md).

All privileged transactions (mint, transfers from the owner) are executed
through the owner multisig's own interface, never from scripts. Scripts here
only deploy, read, and verify.

## Preconditions

- [ ] Owner multisig provisioned; its address recorded in
      `ignition/parameters/<network>.json` under `HTokenModule.multisig`
      and cross-checked by two people.
- [ ] Deployer EOA created fresh, funded with gas only. It never owns anything.
- [ ] Hardhat vars set: `npx hardhat vars set ALCHEMY_API_KEY` (RPC),
      `SEPOLIA_TESTNET_PRIVATE_KEY` (deployer key), `ETHERSCAN_API_KEY`.
- [ ] Full test suite green: `npx hardhat test`

## Phase 1 — Testnet rehearsal

Run this entire runbook on testnet first, same commands with
`--network ethereumSepolia` and a test multisig. Record every tx hash.

## Phase 2 — Token deployment

```bash
npx hardhat ignition deploy ignition/modules/HToken.ts \
  --network <network> --parameters ignition/parameters/<params>.json
npx hardhat verify --network <network> <implementation-address>
```

Expected: implementation, proxy, and ProxyAdmin deployed; proxy initialized
in its constructor with the multisig as owner; source verified on Etherscan.

Then verify via raw RPC (run twice, by two different people):

```bash
VERIFY_PROXY=<proxy> VERIFY_OWNER=<multisig> VERIFY_IMPLEMENTATION=<implementation> \
  npx hardhat run scripts/verify-deployment.ts --network <network>
```

Expected: `All checks passed.` Do not proceed otherwise. No multisig
interaction with the token until this passes.

## Phase 3 — Snapshot

Long-running on mainnet (log scan + per-holder cross-check). Run inside
tmux/screen on a stable machine with an archive-capable RPC.

```bash
SNAPSHOT_TOKEN=<source-token> SNAPSHOT_BLOCK=<block> \
SNAPSHOT_FROM_BLOCK=<source-token-deploy-block> \
SNAPSHOT_EXCLUSIONS=distribution-data/exclusions.json \
SNAPSHOT_CONCURRENCY=8 \
  npx hardhat run scripts/snapshot.ts --network <network>
```

Requests run in parallel (`SNAPSHOT_CONCURRENCY`, default 8 — size it to
your RPC plan's rate limit) with retry/backoff; a permanent failure aborts
rather than skips. Progress is checkpointed to
`distribution-data/checkpoint-<block>.json`: if the run crashes, re-run the
same command and it resumes where it stopped. The checkpoint is locked to
the run parameters, and resumed runs still pass through the full
conservation and cross-check verification.

Expected: `distribution-data/snapshot-<block>.json` written, with the
conservation and cross-checks passed (the script aborts on any mismatch).
Verify: holders total + excluded total = total supply; spot-check a handful
of balances on Etherscan at the snapshot block. Triple-check the exclusion
list separately — it is an input, not an output.

## Phase 4 — Merkle tree

```bash
TREE_SNAPSHOT=distribution-data/snapshot-<block>.json \
  npx hardhat run scripts/build-merkle-tree.ts
```

Expected: `distribution-data/tree-<block>.json` with the root, one proof per
holder, and claims total equal to the snapshot holders total. Verify: a second
person re-runs the command from the same snapshot file and gets the same root.

## Phase 5 — Distributor deployment

Create a parameters file with the new token address, the root from Phase 4,
and the owner multisig, then:

```bash
npx hardhat ignition deploy ignition/modules/MerkleDistributor.ts \
  --network <network> --parameters <distributor-params>.json
npx hardhat verify --network <network> <distributor-address> \
  <token> <root> <owner>
```

Verify on-chain: `token()`, `merkleRoot()`, `owner()` match the parameters
exactly.

## Phase 6 — Mint and funding (multisig ceremony)

Through the owner multisig, with each amount cross-checked against the
snapshot file by two approvers minimum:

1. `mint(treasury, <total supply>)` on the token.
2. `transfer(distributor, <holdersTotal from the snapshot>)`.

Verify: distributor balance equals `holdersTotal` exactly; treasury holds
the remainder.

## Phase 7 — Claims and reconciliation

Publish the distributor address through official channels. Claims are
one-time per account, callable by anyone, always paying the claimed account.

Spot-check early claims: claimed balance equals the snapshot amount, and a
second claim for the same account reverts. After the claim period, the owner
may `withdraw` any unclaimed remainder back to the treasury.
