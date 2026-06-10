# Token Deployment and Distribution

This document describes the contracts and tooling in this repository used to
deploy the HToken and distribute allocations to holders via Merkle claims.

## Components

| Component | Path | Purpose |
|-----------|------|---------|
| Token | `contracts/HToken.sol` | Ownable, upgradeable ERC20 behind a `TransparentUpgradeableProxy` |
| Distributor | `contracts/MerkleDistributor.sol` | One-time claims against an immutable Merkle root |
| Token module | `ignition/modules/HToken.ts` | Deploys implementation + proxy; `initialize` runs in the proxy constructor |
| Distributor module | `ignition/modules/MerkleDistributor.ts` | Deploys the distributor with token, root, and owner parameters |
| Snapshot script | `scripts/snapshot.ts` | Reconstructs holder balances at a fixed block from Transfer logs |
| Tree builder | `scripts/build-merkle-tree.ts` | Builds the claim tree and per-account proofs from a snapshot |
| Deploy verification | `scripts/verify-deployment.ts` | Post-deploy checks via raw RPC (slots, owner, supply) |

## Token deployment

The Ignition module deploys the implementation and the proxy in one unit.
`initialize(multisig)` is executed inside the proxy constructor, so there is
no window where the token exists uninitialized or owned by the deployer.
The deployer EOA only pays gas; it never owns the token, the proxy, or the
ProxyAdmin.

```bash
npx hardhat ignition deploy ignition/modules/HToken.ts \
  --network <network> --parameters ignition/parameters/<params>.json
npx hardhat verify --network <network> <implementation-address>
```

Then verify the deployment independently of any UI:

```bash
VERIFY_PROXY=<proxy> VERIFY_OWNER=<multisig> VERIFY_IMPLEMENTATION=<implementation> \
  npx hardhat run scripts/verify-deployment.ts --network <network>
```

## Distribution pipeline

The pipeline is three separate, independently verifiable steps. All working
data is written to `distribution-data/`, which is gitignored — address lists,
snapshots, and proofs are operational data and are never committed.

### 1. Snapshot

```bash
SNAPSHOT_TOKEN=<token> SNAPSHOT_BLOCK=<block> \
  [SNAPSHOT_EXCLUSIONS=distribution-data/exclusions.json] \
  npx hardhat run scripts/snapshot.ts --network <network>
```

Balances are reconstructed by replaying every `Transfer` log up to the
snapshot block. The result is then verified two independent ways before it
is written:

1. **Conservation** — the sum of all reconstructed balances must equal
   `totalSupply()` at the snapshot block.
2. **Cross-check** — `balanceOf()` at the snapshot block is queried for
   every holder and must match the reconstructed value exactly.

Any mismatch aborts the snapshot. Excluded addresses are reported separately
with their totals and never enter the distribution set.

### 2. Merkle tree

```bash
TREE_SNAPSHOT=distribution-data/snapshot-<block>.json \
  npx hardhat run scripts/build-merkle-tree.ts
```

Builds an OpenZeppelin `StandardMerkleTree` over `(address, uint256)` leaves.
The tree is rebuilt from the same input and compared to guard against
non-determinism, and the sum of all claims is checked against the snapshot
total. The output contains the root and a proof for every account.

### 3. Distributor deployment and funding

```bash
npx hardhat ignition deploy ignition/modules/MerkleDistributor.ts \
  --network <network> --parameters <params-with-token-root-owner>.json
```

The owner then funds the distributor with exactly the holders' total.
Claims are one-time per account, callable by anyone, and always pay the
claimed account. The owner's only power is withdrawing tokens held by the
contract (e.g. unclaimed allocations after the claim period); the root and
token are immutable.

## Testing

```bash
npx hardhat test
```

The suite covers the token (deployment wiring, mint/burn authorization,
transfers, ownership, upgrades through the ProxyAdmin), the distributor
(valid/invalid/duplicate claims, proofs, funding, withdrawal), and an
end-to-end pipeline test: a token with real transfer history is snapshotted
at a fixed block, the tree is built, a fresh token and distributor are
deployed, every holder claims, and final balances must reconcile exactly.
The snapshot and tree code under test is the same code used operationally
(`scripts/lib/`).
