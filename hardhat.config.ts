import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "solidity-docgen";

const SEPOLIA_TESTNET_PRIVATE_KEY = vars.get("SEPOLIA_TESTNET_PRIVATE_KEY");
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY");
const INFURA_API_KEY = vars.get("INFURA_API_KEY");

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  docgen: {},
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      ethereumMainnet: ETHERSCAN_API_KEY,
      ethereumSepolia: ETHERSCAN_API_KEY,
      arbitrumSepolia: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "ethereumMainnet",
        chainId: 1,
        urls: {
          apiURL: "https://api.etherscan.io/api",
          browserURL: "https://etherscan.io/",
        },
      },
      {
        network: "ethereumSepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io/",
        },
      },
    ],
  },
  networks: {
    ethereumMainnet: {
      url: "https://mainnet.infura.io/v3/" + INFURA_API_KEY,
      chainId: 1,
      accounts: [SEPOLIA_TESTNET_PRIVATE_KEY],
    },
    ethereumSepolia: {
      url: "https://sepolia.infura.io/v3/" + INFURA_API_KEY,
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
