import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "solidity-docgen";

const SEPOLIA_TESTNET_PRIVATE_KEY = vars.get("SEPOLIA_TESTNET_PRIVATE_KEY");
// Mainnet deployer key; falls back to the testnet key so the config loads everywhere.
const ETHEREUM_PRIVATE_KEY = vars.get("ETHEREUM_PRIVATE_KEY", SEPOLIA_TESTNET_PRIVATE_KEY);
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY");
const ALCHEMY_API_KEY = vars.get("ALCHEMY_API_KEY");

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  docgen: {},
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    // Etherscan API V2: one key for all chains, routed by chain id.
    apiKey: ETHERSCAN_API_KEY,
  },
  networks: {
    ethereumMainnet: {
      url: "https://eth-mainnet.g.alchemy.com/v2/" + ALCHEMY_API_KEY,
      chainId: 1,
      accounts: [ETHEREUM_PRIVATE_KEY],
    },
    ethereumSepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/" + ALCHEMY_API_KEY,
      chainId: 11155111,
      accounts: [SEPOLIA_TESTNET_PRIVATE_KEY],
    },
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: [SEPOLIA_TESTNET_PRIVATE_KEY],
    },
  },
};

export default config;
