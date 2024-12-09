import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MultisigModule = buildModule("Multisig", (m) => {
  const multisig = m.contract("Multisig", [m.getParameter("MultiSigAccounts")], {});
  return { multisig };
});

export default MultisigModule;
