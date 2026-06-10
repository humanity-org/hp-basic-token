// Ignition module for the MerkleDistributor contract.
// Deploys the distributor with the token address, the Merkle root of the
// allocation tree, and the owner allowed to withdraw held tokens.

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MerkleDistributorModule = buildModule("MerkleDistributorModule", (m) => {
  const token = m.getParameter("token");
  const merkleRoot = m.getParameter("merkleRoot");
  const owner = m.getParameter("owner");
  const distributor = m.contract("MerkleDistributor", [token, merkleRoot, owner]);
  return { distributor };
});

export default MerkleDistributorModule;
