# Solidity API

## BMToken

A simple Ownable and Upgradeable token.

### constructor

```solidity
constructor() public
```

This contract is meant to be initialized and shouldn't do anything in its constructor.

### initialize

```solidity
function initialize(address _initialOwner) public
```

Initializes the token's state. This can only be called once in the lifetime of the token (after initial deployment of the first version).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _initialOwner | address | the address to use as the initial owner of this token. |

### mint

```solidity
function mint(address _account, uint256 _value) public
```

Mint tokens to an address. Only the owner can call this.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _account | address | the address which will receive the tokens. |
| _value | uint256 | the amount of tokens to mint to the account. |

### burn

```solidity
function burn(address _account, uint256 _value) public
```

Burn tokens from an address. Only the owner can call this.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _account | address | the address which will see some of its tokens burned. |
| _value | uint256 | the amount of tokens to burn from the address. |

## BMTokenUpgrade

Test contract to verify if adding functions to the base token works. It does. You can ignore this.

### TestEvent

```solidity
event TestEvent(string data)
```

### test

```solidity
function test() external
```

