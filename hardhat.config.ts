import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config"


const Sepolia_TESTNET_PRIVATE_KEY = vars.get("SEPOLIA_TESTNET_PRIVATE_KEY")

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  gasReporter: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      ethereumSepolia: "6E688KAJCMHQSX4I1B3YSQERJHYJG2B5T5",
      arbitrumSepolia: "6E688KAJCMHQSX4I1B3YSQERJHYJG2B5T5",
    },
    customChains: [
      {
        network: "ethereumSepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io/",
        },
      },
    ]
  },
  networks: {
    ethereumSepolia: {
      url: "https://sepolia.infura.io/v3/013d918b9e1244029dcff95249ed2e02",
      chainId: 11155111,
      accounts: [Sepolia_TESTNET_PRIVATE_KEY]
    },
    arbitrumSepolia: {
      url: 'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      accounts: [Sepolia_TESTNET_PRIVATE_KEY]
    },
  }
};

export default config;
