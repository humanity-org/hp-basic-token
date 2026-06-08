# HToken Pause and Unpause Upgrade Runbook

## Mainnet Addresses

| Name | Address |
| --- | --- |
| HToken proxy | `0xcf5104D094e3864CfCBDa43B82e1cEFD26A016eB` |
| ProxyAdmin | `0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4` |
| Current implementation | `0x761C06A46D3c85ecd87Cf6917B3dE329B95829Be` |
| ProxyAdmin owner multisig | `0x7BbC0d5167017092e2ba599dE6062080b891f645` |

## Choose Upgrade Mode

Use this runbook for either mode:

| Mode | Implementation code to deploy | Expected post-upgrade behavior |
| --- | --- | --- |
| Pause | `contracts/HToken.sol` includes `_update()` reverting with `H_TOKEN_TRANSFERS_PAUSED` | `transfer()` and `transferFrom()` revert |
| Unpause | `contracts/HToken.sol` does not include the pause `_update()` override | `transfer()` and `transferFrom()` succeed normally |

The ProxyAdmin transaction format is the same for both modes.

Do not deploy a new proxy for either mode.

## Preconditions

Set the environment:

```bash
export MAINNET_RPC_URL="https://smart-practical-meadow.ethereum-mainnet.quiknode.pro/xxxx/"
export ETHERSCAN_API_KEY="<etherscan api key>"
```

1. Be on the intended branch.

   ```bash
   git branch --show-current
   ```

   Expected:

   ```text
   hotfix/add-token-pause
   ```

   For an unpause upgrade, use the reviewed branch that removes the pause `_update()` override.

2. Confirm there are no unwanted files in the working tree.

   ```bash
   git status --short
   ```

3. Confirm the intended token behavior in `contracts/HToken.sol`.

   ```bash
   git diff -- contracts/HToken.sol
   ```

4. Confirm no storage variables were added to `contracts/HToken.sol`.

   ```bash
   git diff -- contracts/HToken.sol
   ```

   Go/no-go:

   | Check | Required result |
   | --- | --- |
   | New state variables | none |
   | Initializer changes | none |
   | Constructor changes | none |
   | Proxy changes | none |
   | Pause mode | `_update()` override is present and reverts with `H_TOKEN_TRANSFERS_PAUSED` |
   | Unpause mode | pause `_update()` override is absent |

5. Install npm dependencies.

   ```bash
   npm ci
   ```

6. Run the Foundry tests.

   ```bash
   ~/.foundry/bin/forge test
   ```

7. Compile with Hardhat.

   ```bash
   HARDHAT_VAR_MAINNET_RPC_URL="$MAINNET_RPC_URL" \
   HARDHAT_VAR_ETHERSCAN_API_KEY="$ETHERSCAN_API_KEY" \
   npx hardhat compile
   ```

8. Confirm the target RPC is mainnet.

   ```bash
   cast chain-id --rpc-url "$MAINNET_RPC_URL"
   ```

   Expected:

   ```text
   1
   ```

## Deploy Implementation With Ledger

Connect the Ledger, unlock it, and open the Ethereum app.

Confirm Foundry can see the Ledger:

```bash
cast wallet list --ledger
```

Deploy only the implementation contract:

```bash
~/.foundry/bin/forge create contracts/HToken.sol:HToken \
  --rpc-url "$MAINNET_RPC_URL" \
  --chain 1 \
  --ledger \
  --broadcast \
  --verify \
  --verifier etherscan \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Save the deployed address:

```bash
export NEW_IMPLEMENTATION_ADDRESS="<address from deployment output>"
```

If the Ledger uses a non-default derivation path, add this flag to the `forge create` command:

```bash
--mnemonic-derivation-path "m/44'/60'/0'/0/0"
```

Confirm the deployed implementation has code:

```bash
cast code "$NEW_IMPLEMENTATION_ADDRESS" --rpc-url "$MAINNET_RPC_URL"
```

Go/no-go:

| Check | Required result |
| --- | --- |
| Output | not `0x` |

If automatic verification did not complete, verify the implementation contract:

```bash
HARDHAT_VAR_MAINNET_RPC_URL="$MAINNET_RPC_URL" \
HARDHAT_VAR_ETHERSCAN_API_KEY="$ETHERSCAN_API_KEY" \
npx hardhat verify --network ethereumMainnet "$NEW_IMPLEMENTATION_ADDRESS"
```

## Pre-Upgrade Checks

Set the addresses:

```bash
export MAINNET_RPC_URL="<mainnet rpc url>"
export HTOKEN_PROXY="0xcf5104D094e3864CfCBDa43B82e1cEFD26A016eB"
export PROXY_ADMIN="0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4"
export PROXY_ADMIN_OWNER="0x7BbC0d5167017092e2ba599dE6062080b891f645"
export EXPECTED_CURRENT_IMPLEMENTATION="0x761C06A46D3c85ecd87Cf6917B3dE329B95829Be"
export IMPLEMENTATION_SLOT="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
export ADMIN_SLOT="0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
```

Confirm the ProxyAdmin owner:

```bash
cast call "$PROXY_ADMIN" "owner()(address)" --rpc-url "$MAINNET_RPC_URL"
```

Expected:

```text
0x7BbC0d5167017092e2ba599dE6062080b891f645
```

Confirm the proxy admin slot points to the ProxyAdmin:

```bash
cast storage "$HTOKEN_PROXY" "$ADMIN_SLOT" --rpc-url "$MAINNET_RPC_URL"
```

Expected last 20 bytes:

```text
70ea1d45df2d305628c1757076b57c56bd5d0fd4
```

Record the current implementation:

```bash
cast storage "$HTOKEN_PROXY" "$IMPLEMENTATION_SLOT" --rpc-url "$MAINNET_RPC_URL"
```

Save it:

```bash
export CURRENT_IMPLEMENTATION_ADDRESS="<last 20 bytes from implementation slot as 0x address>"
```

Confirm the current implementation is the expected implementation:

```bash
test "$(echo "$CURRENT_IMPLEMENTATION_ADDRESS" | tr '[:upper:]' '[:lower:]')" = "$(echo "$EXPECTED_CURRENT_IMPLEMENTATION" | tr '[:upper:]' '[:lower:]')"
```

Go/no-go:

| Check | Required result |
| --- | --- |
| Current implementation | `0x761C06A46D3c85ecd87Cf6917B3dE329B95829Be` |

Confirm the new implementation is different from the current implementation:

```bash
test "$(echo "$CURRENT_IMPLEMENTATION_ADDRESS" | tr '[:upper:]' '[:lower:]')" != "$(echo "$NEW_IMPLEMENTATION_ADDRESS" | tr '[:upper:]' '[:lower:]')"
```

Go/no-go:

| Check | Required result |
| --- | --- |
| Current implementation | not equal to `NEW_IMPLEMENTATION_ADDRESS` |

Record total supply:

```bash
cast call "$HTOKEN_PROXY" "totalSupply()(uint256)" --rpc-url "$MAINNET_RPC_URL" > /tmp/htoken-total-supply-before.txt
cat /tmp/htoken-total-supply-before.txt
```

Record balances for any holder addresses that should be checked after execution:

```bash
cast call "$HTOKEN_PROXY" "balanceOf(address)(uint256)" <HOLDER_ADDRESS> --rpc-url "$MAINNET_RPC_URL"
```

Save each checked holder address and balance before execution.

## Safe Transaction Checks

Generate calldata locally before opening Safe:

```bash
export UPGRADE_CALLDATA="$(
  cast calldata "upgradeAndCall(address,address,bytes)" \
    "$HTOKEN_PROXY" \
    "$NEW_IMPLEMENTATION_ADDRESS" \
    0x
)"

echo "$UPGRADE_CALLDATA"
```

Go/no-go:

| Check | Required result |
| --- | --- |
| Calldata prefix | `0x9623609d` |
| Target address | ProxyAdmin |
| ETH value | `0` |
| Third argument | empty bytes `0x` |

Do not proceed if the Safe UI decodes a different target, proxy, implementation, or data value.

## Submit Safe Transaction

Submit exactly one transaction from the ProxyAdmin owner multisig.

| Field | Value |
| --- | --- |
| Target / To | `0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4` |
| Value | `0` ETH |
| Function | `upgradeAndCall(address,address,bytes)` |
| `proxy` | `0xcf5104D094e3864CfCBDa43B82e1cEFD26A016eB` |
| `implementation` | `NEW_IMPLEMENTATION_ADDRESS` |
| `data` | `0x` |

The `data` argument must be empty bytes: `0x`.

Do not enter `"0x"` as a string value.

Optional raw calldata:

```bash
echo "$UPGRADE_CALLDATA"
```

The calldata must start with:

```text
0x9623609d
```

If using raw calldata in Safe:

| Field | Value |
| --- | --- |
| Target / To | `0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4` |
| Value | `0` ETH |
| Data | output from the `cast calldata` command |

Before signing, confirm all four items:

1. Target is the ProxyAdmin: `0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4`
2. Proxy argument is the existing HToken proxy: `0xcf5104D094e3864CfCBDa43B82e1cEFD26A016eB`
3. Implementation argument is `NEW_IMPLEMENTATION_ADDRESS`
4. Data argument is empty bytes: `0x`

Collect the required multisig approvals and execute.

## Final Go/No-Go Checklist

Do not execute unless every item is true.

| Check | Required result |
| --- | --- |
| Chain ID | `1` |
| Safe address | `0x7BbC0d5167017092e2ba599dE6062080b891f645` |
| Safe transaction target | `0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4` |
| Safe transaction value | `0` ETH |
| Function selector | `0x9623609d` |
| Proxy argument | `0xcf5104D094e3864CfCBDa43B82e1cEFD26A016eB` |
| Implementation argument | `NEW_IMPLEMENTATION_ADDRESS` |
| Data argument | `0x` |
| New implementation code | non-empty |
| New implementation source | verified |
| Current implementation | `0x761C06A46D3c85ecd87Cf6917B3dE329B95829Be` and not equal to new implementation |
| Proxy admin slot | points to `0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4` |
| ProxyAdmin owner | `0x7BbC0d5167017092e2ba599dE6062080b891f645` |
| Foundry tests | passing |
| Hardhat compile | passing |

## Shared Post-Upgrade Checks

Confirm the proxy implementation changed:

```bash
cast storage "$HTOKEN_PROXY" "$IMPLEMENTATION_SLOT" --rpc-url "$MAINNET_RPC_URL"
```

The last 20 bytes must equal `NEW_IMPLEMENTATION_ADDRESS`.

Save the new slot value:

```bash
cast storage "$HTOKEN_PROXY" "$IMPLEMENTATION_SLOT" --rpc-url "$MAINNET_RPC_URL" > /tmp/htoken-implementation-after.txt
cat /tmp/htoken-implementation-after.txt
```

Confirm total supply is unchanged:

```bash
cast call "$HTOKEN_PROXY" "totalSupply()(uint256)" --rpc-url "$MAINNET_RPC_URL" > /tmp/htoken-total-supply-after.txt
cat /tmp/htoken-total-supply-after.txt
diff /tmp/htoken-total-supply-before.txt /tmp/htoken-total-supply-after.txt
```

Confirm sampled balances are unchanged:

```bash
cast call "$HTOKEN_PROXY" "balanceOf(address)(uint256)" <HOLDER_ADDRESS> --rpc-url "$MAINNET_RPC_URL"
```

Compare each checked balance against the value recorded before execution.

Confirm the ProxyAdmin owner is unchanged:

```bash
cast call "$PROXY_ADMIN" "owner()(address)" --rpc-url "$MAINNET_RPC_URL"
```

Expected:

```text
0x7BbC0d5167017092e2ba599dE6062080b891f645
```

## Pause Post-Upgrade Checks

Confirm `transfer()` reverts:

```bash
cast call "$HTOKEN_PROXY" \
  "transfer(address,uint256)(bool)" \
  0x0000000000000000000000000000000000000002 \
  0 \
  --from 0x0000000000000000000000000000000000000001 \
  --rpc-url "$MAINNET_RPC_URL"
```

Expected revert reason:

```text
H_TOKEN_TRANSFERS_PAUSED
```

Confirm `transferFrom()` reverts:

```bash
cast call "$HTOKEN_PROXY" \
  "transferFrom(address,address,uint256)(bool)" \
  0x0000000000000000000000000000000000000001 \
  0x0000000000000000000000000000000000000002 \
  0 \
  --from 0x0000000000000000000000000000000000000001 \
  --rpc-url "$MAINNET_RPC_URL"
```

Expected revert reason:

```text
H_TOKEN_TRANSFERS_PAUSED
```

Pause mode required results:

| Check | Required result |
| --- | --- |
| Implementation slot | last 20 bytes equal `NEW_IMPLEMENTATION_ADDRESS` |
| `transfer()` | reverts with `H_TOKEN_TRANSFERS_PAUSED` |
| `transferFrom()` | reverts with `H_TOKEN_TRANSFERS_PAUSED` |
| Total supply | unchanged |
| Sampled balances | unchanged |
| ProxyAdmin owner | unchanged |

## Unpause Post-Upgrade Checks

Confirm `transfer()` succeeds in an `eth_call` with amount `0`:

```bash
cast call "$HTOKEN_PROXY" \
  "transfer(address,uint256)(bool)" \
  0x0000000000000000000000000000000000000002 \
  0 \
  --from 0x0000000000000000000000000000000000000001 \
  --rpc-url "$MAINNET_RPC_URL"
```

Expected:

```text
true
```

Confirm `transferFrom()` succeeds in an `eth_call` with amount `0`:

```bash
cast call "$HTOKEN_PROXY" \
  "transferFrom(address,address,uint256)(bool)" \
  0x0000000000000000000000000000000000000001 \
  0x0000000000000000000000000000000000000002 \
  0 \
  --from 0x0000000000000000000000000000000000000001 \
  --rpc-url "$MAINNET_RPC_URL"
```

Expected:

```text
true
```

Unpause mode required results:

| Check | Required result |
| --- | --- |
| Implementation slot | last 20 bytes equal `NEW_IMPLEMENTATION_ADDRESS` |
| `transfer()` | succeeds |
| `transferFrom()` | succeeds |
| Total supply | unchanged |
| Sampled balances | unchanged |
| ProxyAdmin owner | unchanged |

## Unpause Preparation

To unpause, prepare and review an implementation where `contracts/HToken.sol` does not override `_update()` with `H_TOKEN_TRANSFERS_PAUSED`.

Run:

```bash
git diff -- contracts/HToken.sol
npm ci
~/.foundry/bin/forge test
HARDHAT_VAR_MAINNET_RPC_URL="$MAINNET_RPC_URL" \
HARDHAT_VAR_ETHERSCAN_API_KEY="$ETHERSCAN_API_KEY" \
npx hardhat compile
```

Then use the same `Deploy Implementation With Ledger`, `Pre-Upgrade Checks`, `Safe Transaction Checks`, `Submit Safe Transaction`, `Final Go/No-Go Checklist`, and `Shared Post-Upgrade Checks` sections with the unpaused `NEW_IMPLEMENTATION_ADDRESS`.

The Safe transaction remains:

| Field | Value |
| --- | --- |
| Target / To | `0x70ea1D45DF2d305628c1757076B57C56bd5D0Fd4` |
| Value | `0` ETH |
| Function | `upgradeAndCall(address,address,bytes)` |
| `proxy` | `0xcf5104D094e3864CfCBDa43B82e1cEFD26A016eB` |
| `implementation` | unpaused implementation address |
| `data` | `0x` |

Do not deploy a new proxy for unpause.
