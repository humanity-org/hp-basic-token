// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// contract BMTokenV2 is 
// 	Initializable, 
// 	ERC20Upgradeable, 
// 	OwnableUpgradeable 
// {
//     string private constant NAME = "BMToken";
//     string private constant SYMBOL = "BMTN";

//     uint256 private _extraData;

//     constructor() {
//         _disableInitializers();
//     }

//     function initialize(/* string memory name, string memory symbol, */ uint256 initialSupply) public initializer {
//         __ERC20_init(NAME, SYMBOL); // Initialize the ERC20 token
//         __Ownable_init();           // Initialize the Ownable contract

// 	// do i need to mint initially ???
//         _mint(msg.sender, initialSupply); // Mint initial supply to the deployer
//     }

//     // Reinitializer for V2-specific setup
//     function reinitializeV2(uint256 newExtraData) public reinitializer(2) {
//         _extraData = newExtraData;
//     }

//     // test adding additional function in V2
//     function burn(uint256 amount) public {
//         _burn(msg.sender, amount); // Allow users to burn their tokens
//     }

//     // Updated version identifier.  Testing overriding old function
//     function version() public pure returns (string memory) {
//         return "V2";
//     }

//     // test adding function
//     function getExtraData() public view returns (uint256) {
//         return _extraData;
//     }

//     // test adding function
//     function getExtraData2() public view returns (uint256) {
//         return _extraData;
//     }
// }
