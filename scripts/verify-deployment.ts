// scripts/verify-deployment.ts
//
// Post-deployment verification for the HToken proxy setup. Reads everything
// via raw RPC (storage slots and direct calls) so it does not trust any UI.
// Run with: npx hardhat run scripts/verify-deployment.ts --network <network>
//
// Environment variables:
//   VERIFY_PROXY           the token proxy address                      [required]
//   VERIFY_OWNER           expected token owner (multisig)              [required]
//   VERIFY_IMPLEMENTATION  expected implementation address              (optional)
//
// Checks:
//   1. owner() equals the expected owner.
//   2. EIP-1967 admin slot resolves to a ProxyAdmin owned by the same owner.
//   3. EIP-1967 implementation slot matches the expected implementation.
//   4. name() / symbol() / totalSupply() match the expected launch state.
//   5. initialize() cannot be called again.

import { ethers } from "hardhat";

// EIP-1967 storage slots.
const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

let failures = 0;

function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${detail}`);
  if (!ok) {
    failures++;
  }
}

async function main() {
  const proxyAddress = process.env.VERIFY_PROXY;
  const expectedOwner = process.env.VERIFY_OWNER;
  if (!proxyAddress || !expectedOwner) {
    throw new Error("VERIFY_PROXY and VERIFY_OWNER are required");
  }
  const provider = ethers.provider;
  const token = await ethers.getContractAt("HToken", proxyAddress);

  // 1. Token owner.
  const owner = await token.owner();
  check(
    "token owner",
    owner.toLowerCase() === expectedOwner.toLowerCase(),
    `owner() = ${owner}, expected ${expectedOwner}`
  );

  // 2. ProxyAdmin from the EIP-1967 admin slot, and its owner.
  const adminSlot = await provider.getStorage(proxyAddress, ADMIN_SLOT);
  const proxyAdminAddress = ethers.getAddress(ethers.dataSlice(adminSlot, 12));
  check(
    "admin slot",
    proxyAdminAddress !== ethers.ZeroAddress,
    `EIP-1967 admin = ${proxyAdminAddress}`
  );
  const proxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
  const proxyAdminOwner = await proxyAdmin.owner();
  check(
    "proxy admin owner",
    proxyAdminOwner.toLowerCase() === expectedOwner.toLowerCase(),
    `ProxyAdmin owner() = ${proxyAdminOwner}, expected ${expectedOwner}`
  );

  // 3. Implementation slot.
  const implementationSlot = await provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  const implementation = ethers.getAddress(ethers.dataSlice(implementationSlot, 12));
  if (process.env.VERIFY_IMPLEMENTATION) {
    check(
      "implementation",
      implementation.toLowerCase() === process.env.VERIFY_IMPLEMENTATION.toLowerCase(),
      `EIP-1967 implementation = ${implementation}, expected ${process.env.VERIFY_IMPLEMENTATION}`
    );
  } else {
    console.log(`INFO  implementation: ${implementation} (no expected value provided)`);
  }

  // 4. Launch state.
  const name = await token.name();
  const symbol = await token.symbol();
  const totalSupply = await token.totalSupply();
  check("name", name === "Humanity", `name() = "${name}"`);
  check("symbol", symbol === "H", `symbol() = "${symbol}"`);
  check("total supply", totalSupply === 0n, `totalSupply() = ${totalSupply}`);

  // 5. initialize() must revert (already initialized through the proxy constructor).
  let initializeReverts = false;
  try {
    await token.initialize.staticCall(expectedOwner);
  } catch {
    initializeReverts = true;
  }
  check("initialize locked", initializeReverts, "initialize() reverts when called again");

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
