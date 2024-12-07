// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// interface BMEnabledToken {
//     /// @notice should return `0xb1` if token is enabled for arbitrum gateways
//     /// @dev Previous implmentation used to return `uint8(0xa4b1)`, however that causes compile time error in Solidity 0.8. due to type mismatch.
//     ///      In current version `uint8(0xb1)` shall be returned, which results in no change as that's the same value as truncated `uint8(0xa4b1)`.
//     function isBMEnabled() external view returns (uint8);
// }

// interface IReverseToken is BMEnabledToken {
//     struct RegistrationParams {
//         address l2TokenAddress;
//         uint256 maxSubmissionCostForCustomGateway;
//         uint256 maxSubmissionCostForRouter;
//         uint256 maxGasForCustomGateway;
//         uint256 maxGasForRouter;
//         uint256 gasPriceBid;
//         uint256 valueForGateway;
//         uint256 valueForRouter;
//         address creditBackAddress;
//     }

//     function registerTokenOnL2(RegistrationParams memory novaParams) external payable;

//     function transferFrom(address sender, address recipient, uint256 amount)
//         external
//         returns (bool);

//     function balanceOf(address account) external view returns (uint256);

//     function bridgeMint(address account, uint256 amount) external;

//     function bridgeBurn(address account, uint256 amount) external;
// }

// interface IL1CustomGateway {
//     function registerTokenToL2(
//         address _l2Address,
//         uint256 _maxGas,
//         uint256 _gasPriceBid,
//         uint256 _maxSubmissionCost,
//         address _creditBackAddress
//     ) external payable returns (uint256);
// }

// interface IGatewayRouter {
//     function setGateway(
//         address _gateway,
//         uint256 _maxGas,
//         uint256 _gasPriceBid,
//         uint256 _maxSubmissionCost,
//         address _creditBackAddress
//     ) external payable returns (uint256);
// }

// contract BMTokenV3 is 
// 	IReverseToken,
// 	Initializable, 
// 	ERC20Upgradeable, 
// 	OwnableUpgradeable 
// {
//     string private constant NAME = "BMToken";
//     string private constant SYMBOL = "BMTN";

//     uint256 private _extraData;
//     uint256 private _extraDataV3;

//     uint16 private constant MAGIC_BM_ONE = 0xa4b1;

//     bool private shouldRegisterGateway;

//     address public bmOneGateway;
//     address public bmRouter;
//     address public bmGateway;

//     constructor() {
//         _disableInitializers();
//     }

//     function initialize(/* string memory name, string memory symbol, */ uint256 initialSupply) public initializer {
//         __ERC20_init(NAME, SYMBOL); // Initialize the ERC20 token
//         __Ownable_init();           // Initialize the Ownable contract

// 	// do i need to mint initially ???
//         _mint(msg.sender, initialSupply); // Mint initial supply to the deployer
//     }

//     // Testing dropping the following function
//     // function reinitializeV2(uint256 newExtraData) public reinitializer(2) {
//     //     _extraData = newExtraData;
//     // }

//     // Reinitializer for V3-specific setup
//     function reinitializeV3(uint256 newExtraData) public reinitializer(3) {
//         _extraDataV3 = newExtraData;
//     }

//     // inherit from V2
//     function burn(uint256 amount) public {
//         _burn(msg.sender, amount); // Allow users to burn their tokens
//     }

//     // Updated version identifier
//     function version() public pure returns (string memory) {
//         return "V3";
//     }

//     // TEST redefining the function
//     function getExtraData() public view returns (uint256) {
//         return _extraDataV3;
//     }

//     // test deleting a function from V2
//     // function getExtraData2() public view returns (uint256) {
//     //    return _extraData;
//     // }

//     // Test override
//     function balanceOf(address account)
//         public
//         view
//         override(ERC20Upgradeable)
//         returns (uint256 amount)
//     {
//         return ERC20Upgradeable.balanceOf(account);
//     }


//     // Test override
//     function transferFrom(address sender, address recipient, uint256 amount)
//         public
//         override(ERC20Upgradeable)
//         returns (bool)
//     {
//         return ERC20Upgradeable.transferFrom(sender, recipient, amount);
//     }

//     /// @dev shouldRegisterGateway is set to true when in `registerTokenOnL2`
//     function isBMEnabled() external view override returns (uint8) {
//         require(shouldRegisterGateway, "L1BMToken: not expecting gateway registration");
//         return uint8(MAGIC_BM_ONE);
//     }

//     // modifier onlyBMOneGateway() {
//     //     require(msg.sender == arbOneGateway, "L1ArbitrumToken: only l1 arb one gateway");
//     //     _;
//     // }

//     // /// @notice Allow the Arb One bridge to mint tokens
//     // function bridgeMint(address account, uint256 amount)
//     //     public
//     //     override(IReverseToken)
//     //     onlyArbOneGateway
//     // {
//     //     _mint(account, amount);
//     // }

//     // /// @notice Allow the Arb One bridge to burn tokens
//     // function bridgeBurn(address account, uint256 amount)
//     //     public
//     //     override(IReverseToken)
//     //     onlyArbOneGateway
//     // {
//     //     _burn(account, amount);
//     // }

//     /// @notice Register the token on both Arb One and Nova
//     /// @dev    Called once by anyone immediately after the contract is deployed
//     // function registerTokenOnL2(RegistrationParams memory novaParams) public payable {
//     //     // we temporarily set `shouldRegisterGateway` to true for the callback in registerTokenToL2 to succeed
//     //     // this is so that we can be sure that this contract does currently mean to be
//     //     // doing a registration
//     //     bool prev = shouldRegisterGateway;
//     //     shouldRegisterGateway = true;

//     //     IL1CustomGateway(bmGateway).registerTokenToL2{value: novaParams.valueForGateway}(
//     //         novaParams.l2TokenAddress,
//     //         novaParams.maxGasForCustomGateway,
//     //         novaParams.gasPriceBid,
//     //         novaParams.maxSubmissionCostForCustomGateway,
//     //         novaParams.creditBackAddress
//     //     );

//     //     IGatewayRouter(bmRouter).setGateway{value: novaParams.valueForRouter}(
//     //         novaGateway,
//     //         novaParams.maxGasForRouter,
//     //         novaParams.gasPriceBid,
//     //         novaParams.maxSubmissionCostForRouter,
//     //         novaParams.creditBackAddress
//     //     );

//     //     shouldRegisterGateway = prev;
//     // }
// }
