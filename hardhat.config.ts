import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "solidity-docgen";

const DEPLOYER_PRIVATE_KEY = vars.get(
  "DEPLOYER_PRIVATE_KEY",
  vars.get("SEPOLIA_TESTNET_PRIVATE_KEY", "")
);
const ETHERSCAN_API_KEY = vars.get("ETHERSCAN_API_KEY");
const MAINNET_RPC_URL = vars.get("MAINNET_RPC_URL", "http://127.0.0.1:8545");
const SEPOLIA_RPC_URL = vars.get("SEPOLIA_RPC_URL", "http://127.0.0.1:8545");
const DEPLOYER_ACCOUNTS = DEPLOYER_PRIVATE_KEY === "" ? [] : [DEPLOYER_PRIVATE_KEY];

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
      url: MAINNET_RPC_URL,
      chainId: 1,
      accounts: DEPLOYER_ACCOUNTS,
    },
    ethereumSepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: DEPLOYER_ACCOUNTS,
    },
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: DEPLOYER_ACCOUNTS,
    },
  },
};

export default config;
