import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HTokenImplementationModule = buildModule("HTokenImplementationModule", (m) => {
  const hTokenImplementation = m.contract("HToken", [], {
    id: "HTokenImplementation",
  });

  return { hTokenImplementation };
});

export default HTokenImplementationModule;
