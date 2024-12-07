BMToken: simple Erc20 contract
BMToken2: testing functions' overriding, deleting, adding
BMToken3: testing referring to bridge contracts

============================================

Here is a complete **ERC20 upgradeable smart contract** using OpenZeppelin, with step-by-step instructions for deploying it in Remix IDE.

---

### **1. Implementation Contract (ERC20 V1)**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MyUpgradeableToken is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    function initialize(string memory name, string memory symbol, uint256 initialSupply) public initializer {
        __ERC20_init(name, symbol); // Initialize the ERC20 token
        __Ownable_init();           // Initialize the Ownable contract
        _mint(msg.sender, initialSupply); // Mint initial supply to the deployer
    }

    // Example function for future upgrades
    function version() public pure returns (string memory) {
        return "V1";
    }
}
```

---

### **2. Upgraded Implementation (ERC20 V2)**

If you later want to upgrade the contract with new functionality (e.g., a burn function), create a new version:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract MyUpgradeableTokenV2 is Initializable, ERC20Upgradeable, OwnableUpgradeable {
    function initialize(string memory name, string memory symbol, uint256 initialSupply) public initializer {
        __ERC20_init(name, symbol); // Initialize the ERC20 token
        __Ownable_init();           // Initialize the Ownable contract
        _mint(msg.sender, initialSupply); // Mint initial supply to the deployer
    }

    // Additional function in V2
    function burn(uint256 amount) public {
        _burn(msg.sender, amount); // Allow users to burn their tokens
    }

    // Updated version identifier
    function version() public pure returns (string memory) {
        return "V2";
    }
}
```

---

### **3. Steps to Deploy Using Remix IDE**

#### **Step 1: Deploy the Proxy (Using TransparentUpgradeableProxy)**
To deploy an upgradeable contract, you need a proxy to point to the logic contract. Remix doesn't have a built-in plugin for proxies, so you'll deploy both the logic contract (V1) and manually set up the proxy.

1. **Compile `MyUpgradeableToken`**:
   - Go to the **Solidity Compiler** tab, select `MyUpgradeableToken`, and compile it.

2. **Deploy the Logic Contract (V1)**:
   - Go to the **Deploy & Run Transactions** tab.
   - Select the `MyUpgradeableToken` contract and deploy it.

3. **Deploy the Proxy Contract**:
   - Create a new contract file in Remix with the following code:

   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.0;

   import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

   contract ProxyDeployer {
       TransparentUpgradeableProxy public proxy;

       constructor(address logic, address admin, bytes memory data) {
           proxy = new TransparentUpgradeableProxy(logic, admin, data);
       }
   }
   ```

   - Replace `address logic` with the deployed address of `MyUpgradeableToken`.
   - Replace `address admin` with your own wallet address or another admin address.

4. **Initialize the Proxy**:
   - Call the `initialize` function on the proxy, providing the name, symbol, and initial supply for the token.

---

#### **Step 2: Upgrade to V2**

1. **Deploy the V2 Logic Contract**:
   - Compile and deploy `MyUpgradeableTokenV2` from the Solidity Compiler tab.

2. **Upgrade the Proxy to Point to V2**:
   - Use the `TransparentUpgradeableProxy` admin address to upgrade the proxy to the new V2 logic contract.
   - This can be done by interacting with the proxy admin's `upgrade` function.

3. **Test the Upgraded Contract**:
   - Use the proxy address to call functions, such as `burn` or `version`, to verify the upgrade.

---

### **Important Notes**
- Always test your contracts on a testnet before deploying to the mainnet.
- Ensure proper access control for the proxy admin to prevent unauthorized upgrades.
- Use tools like **OpenZeppelin Upgrades Plugin** for better automation in a production environment.