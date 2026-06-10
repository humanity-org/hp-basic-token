# Upgrade & Ownership Runbook

Operator sequence for upgrading the HToken implementation behind its
`TransparentUpgradeableProxy`, and for transferring ownership. Companion to
[runbook.md](runbook.md) (deployment/distribution) and
[distribution.md](distribution.md) (components).

Two distinct powers exist, held by the owner multisig:

| Power | Held via | Function |
|-------|----------|----------|
| Change the implementation | ProxyAdmin | `upgradeAndCall(proxy, newImpl, data)` |
| Mint / burn / transfer ownership | Token (proxy) | `mint`, `burn`, `transferOwnership` |

All privileged calls are executed through the owner multisig's interface,
decoded and simulated by each signer before signing. `renounceOwnership`
must never be proposed or signed, on either contract.

## Upgrading the implementation

### 1. Write and test the new implementation

- Extend the current contract or re-declare it with an **append-only**
  storage layout: never remove, reorder, or retype existing state variables;
  add new ones at the end only.
- If the upgrade needs one-time setup, guard it with
  `reinitializer(n)` (n = next version) — never a plain `initializer`.
- Add tests that run the upgrade through the ProxyAdmin and assert existing
  state (balances, owner, supply) survives. See the "upgrade path" tests in
  `test/HToken.ts` for the pattern.
- Full suite green: `npx hardhat test`

### 2. Rehearse on testnet

Run this entire sequence on testnet first, with the same scripts and a test
multisig. Record tx hashes.

### 3. Deploy and verify the new implementation

```bash
npx hardhat ignition deploy ignition/modules/<NewImplModule>.ts --network <network>
npx hardhat verify --network <network> <new-implementation-address>
```

The implementation deploys with initializers disabled (constructor calls
`_disableInitializers()`), so it is inert until the proxy points at it.
Confirm on Etherscan that the verified source matches the reviewed commit.

### 4. Execute the upgrade through the multisig

Propose on the **ProxyAdmin**:

```
upgradeAndCall(<proxy>, <new-implementation>, <data>)
```

`data` is `0x` unless the upgrade has a `reinitializer` to call, in which
case it is the encoded call. Every signer independently decodes the
calldata and verifies all three values against the shared address book
before signing.

### 5. Post-upgrade verification (two people, raw RPC)

- [ ] EIP-1967 implementation slot equals the new implementation address.
- [ ] Token `owner()` unchanged; ProxyAdmin `owner()` unchanged.
- [ ] `name()`, `symbol()`, `totalSupply()` unchanged; spot-check several
      holder balances against pre-upgrade values.
- [ ] New functionality behaves as tested; old functionality intact.

`scripts/verify-deployment.ts` covers the slot and owner checks:

```bash
VERIFY_PROXY=<proxy> VERIFY_OWNER=<multisig> VERIFY_IMPLEMENTATION=<new-impl> \
  npx hardhat run scripts/verify-deployment.ts --network <network>
```

## Transferring ownership

Ownership moves (e.g. to a higher-threshold or cold multisig) are **two
separate transactions** — the token and the ProxyAdmin each have an owner:

1. Token (proxy address): `transferOwnership(<new-owner>)`
2. ProxyAdmin: `transferOwnership(<new-owner>)`

`Ownable` here is single-step — a wrong address is unrecoverable. The new
owner address must be confirmed on-chain as the intended multisig (threshold
and owner set verified via `getThreshold()` / `getOwners()`) and
cross-checked by two people against the address book before either
transaction is proposed.

Afterwards verify, via raw RPC: `owner()` on the token AND on the ProxyAdmin
both equal the new multisig, and a simulated privileged call from the old
owner reverts. Rehearse the full move on testnet first.
