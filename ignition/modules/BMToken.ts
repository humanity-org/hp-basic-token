// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BMTokenModule = buildModule("BMTokenModule", (m) => {
  const multisig = m.getParameter("multisig")
  const bmTokenImplementation = m.contract("BMToken", [], { id: "BMTokenImplementation"});
  const proxy = m.contract("TransparentUpgradeableProxy", [
    bmTokenImplementation,
    multisig,
    m.encodeFunctionCall(bmTokenImplementation, "initialize", [multisig])
  ])
  const proxyAdminAddress = m.readEventArgument(proxy, "AdminChanged", "newAdmin")
  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress)
  const bmToken = m.contractAt("BMToken", proxy)
  return { proxy, proxyAdmin, bmToken };
});

export default BMTokenModule;
