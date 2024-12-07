// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// contract BMToken is 
// 	Initializable, 
// 	ERC20Upgradeable, 
// 	OwnableUpgradeable 
// {
//     string private constant NAME = "BMToken";
//     string private constant SYMBOL = "BMTN";

//     constructor() {
//         _disableInitializers();
//     }

//     function initialize( /* string memory name, string memory symbol, */ uint256 initialSupply) public initializer {
//         __ERC20_init(NAME, SYMBOL); // Initialize the ERC20 token
//         __Ownable_init();           // Initialize the Ownable contract

// 	// do i need to mint initially ???
//         _mint(msg.sender, initialSupply); // Mint initial supply to the deployer
//     }

//     // Example function for future upgrades
//     function version() public pure returns (string memory) {
//         return "V1";
//     }
// }
