// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IReverseToken.sol";

contract BMToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize(address _initialOwner) public initializer {
        __Ownable_init(_initialOwner);
        __ERC20_init("BMToken", "BMTN");
    }

    function mint(address _account, uint256 _value) public onlyOwner {
        _mint(_account, _value);
    }

    function burn(address _account, uint256 _value) public onlyOwner {
        _burn(_account, _value);
    }

    // /// @notice Allow the Arb One bridge to mint tokens
    // function bridgeMint(address account, uint256 amount)
    //     public
    //     override(IReverseToken)
    //     // onlyArbOneGateway
    // {
    //     _mint(account, amount);
    // }

    // /// @notice Allow the Arb One bridge to burn tokens
    // function bridgeBurn(address account, uint256 amount)
    //     public
    //     override(IReverseToken)
    //     // onlyArbOneGateway
    // {
    //     _burn(account, amount);
    // }

    /// @dev shouldRegisterGateway is set to true when in `registerTokenOnL2`
    // function isBMEnabled() external view override returns (uint8) {
    //     require(shouldRegisterGateway, "L1BMToken: not expecting gateway registration");
    //     return uint8(MAGIC_BM_ONE);
    // }

    /// @notice Register the token on both Arb One and Nova
    /// @dev    Called once by anyone immediately after the contract is deployed
    // function registerTokenOnL2(RegistrationParams memory novaParams) public payable {
    //     // we temporarily set `shouldRegisterGateway` to true for the callback in registerTokenToL2 to succeed
    //     // this is so that we can be sure that this contract does currently mean to be
    //     // doing a registration
    //     bool prev = shouldRegisterGateway;
    //     shouldRegisterGateway = true;

    //     IL1CustomGateway(bmGateway).registerTokenToL2{value: novaParams.valueForGateway}(
    //         novaParams.l2TokenAddress,
    //         novaParams.maxGasForCustomGateway,
    //         novaParams.gasPriceBid,
    //         novaParams.maxSubmissionCostForCustomGateway,
    //         novaParams.creditBackAddress
    //     );

    //     IGatewayRouter(bmRouter).setGateway{value: novaParams.valueForRouter}(
    //         novaGateway,
    //         novaParams.maxGasForRouter,
    //         novaParams.gasPriceBid,
    //         novaParams.maxSubmissionCostForRouter,
    //         novaParams.creditBackAddress
    //     );

    //     shouldRegisterGateway = prev;
    // }
}