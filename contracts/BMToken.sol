// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// A simple Ownable and Upgradeable token.
contract BMToken is Initializable, OwnableUpgradeable, ERC20Upgradeable {

    /// @notice This contract is meant to be initialized and shouldn't do anything in its constructor.
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the token's state. This can only be called once in the lifetime of the token (after initial deployment of the first version).
    /// @param _initialOwner the address to use as the initial owner of this token.
    function initialize(address _initialOwner) public initializer {
        __Ownable_init(_initialOwner);
        __ERC20_init("Humanity", "H");
    }

    /// @notice Mint tokens to an address. Only the owner can call this.
    /// @param _account the address which will receive the tokens.
    /// @param _value the amount of tokens to mint to the account.
    function mint(address _account, uint256 _value) public onlyOwner {
        _mint(_account, _value);
    }

    /// @notice Burn tokens from an address. Only the owner can call this.
    /// @param _account the address which will see some of its tokens burned.
    /// @param _value the amount of tokens to burn from the address.
    function burn(address _account, uint256 _value) public onlyOwner {
        _burn(_account, _value);
    }
}