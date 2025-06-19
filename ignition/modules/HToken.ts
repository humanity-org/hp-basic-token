// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HTokenModule = buildModule("HTokenModule", (m) => {
  const multisig = m.getParameter("multisig")
  const hTokenImplementation = m.contract("HToken", [], { id: "HTokenImplementation"});
  const proxy = m.contract("TransparentUpgradeableProxy", [
    hTokenImplementation,
    multisig,
    m.encodeFunctionCall(hTokenImplementation, "initialize", [multisig])
  ])
  const proxyAdminAddress = m.readEventArgument(proxy, "AdminChanged", "newAdmin")
  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress)
  const hToken = m.contractAt("HToken", proxy)
  return { proxy, proxyAdmin, hToken };
});

export default HTokenModule;
