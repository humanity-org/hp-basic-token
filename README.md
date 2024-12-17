# BMToken

## Token Contract Architecture

The BMToken contract is deployed as a TransparentUpgradeableProxy contract. The ProxyAdmin contract is the owner of the TransparentUpgradeableProxy contract. The BMToken contract itself is simply the implementation contract of the TransparentUpgradeableProxy contract. The owner of the BMToken (the proxy) can be different from the owner of the ProxyAdmin contract. Currently, the owner of the ProxyAdmin contract is the owner of the BMToken (this is set to a multisig safe wallet).

## Ownership

To change the ownership of the ProxyAdmin contract, you can call the `transferOwnership` function of the ProxyAdmin contract. This will change the owner of the ProxyAdmin contract to the new owner. You can do this using the safe wallet interface easily.

Similarly, to change the ownership of the BMToken (who can mint and burn tokens), you can call the `transferOwnership` function of the BMToken. This will change the owner of the BMToken to the new owner. You can do this using the safe wallet interface easily.

## Upgrading

1. Make changes to the BMToken contract as seen in the `contracts/test/BMTokenUpgrade.sol` file
2. Write tests to verify the new functionality doesn't cause any bugs
3. Deploy the new version of the BMToken contract (this contract is referred to as the implementation contract)
4. Have the owner of the ProxyAdmin of the BMToken (proxy) contract call the `upgradeAndCall` function of the ProxyAdmin contract with the proxy address, the new implementation address and optional data
5. Update the proxy on etherscan so it uses the new implementation's abi

## Functionality

The BMToken contract has the following functionality (apart from the standard ERC20 functionality):

- Minting tokens
- Burning tokens

Both functions are only callable by the owner of the BMToken. The tool you use to interact with the BMToken should properly display the interface of those functions.

You can see documentation for these functions in the `docs` folder.

# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
