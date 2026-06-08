pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {
    ITransparentUpgradeableProxy,
    ProxyAdmin,
    TransparentUpgradeableProxy
} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import { HToken } from "../contracts/HToken.sol";

contract HTokenUnpaused is OwnableUpgradeable, ERC20Upgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __ERC20_init("Humanity", "H");
    }

    function mint(address account, uint256 value) public onlyOwner {
        _mint(account, value);
    }

    function burn(address account, uint256 value) public onlyOwner {
        _burn(account, value);
    }
}

contract HTokenPauseTest is Test {
    bytes32 private constant IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 private constant ADMIN_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);

    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);
    address private spender = address(0x5EED);

    HToken private hToken;
    HTokenUnpaused private originalImplementation;
    HToken private pausedImplementation;
    TransparentUpgradeableProxy private proxy;
    ProxyAdmin private proxyAdmin;

    function setUp() public {
        originalImplementation = new HTokenUnpaused();
        proxy = new TransparentUpgradeableProxy(
            address(originalImplementation),
            address(this),
            abi.encodeCall(HTokenUnpaused.initialize, (address(this)))
        );

        hToken = HToken(address(proxy));
        proxyAdmin = ProxyAdmin(_addressFromSlot(address(proxy), ADMIN_SLOT));

        hToken.mint(alice, 100 ether);

        vm.prank(alice);
        hToken.approve(spender, 10 ether);

        pausedImplementation = new HToken();
    }

    function test_upgradeChangesImplementationAndBlocksTransfers() public {
        assertEq(_addressFromSlot(address(proxy), IMPLEMENTATION_SLOT), address(originalImplementation));

        uint256 aliceBalanceBefore = hToken.balanceOf(alice);
        uint256 bobBalanceBefore = hToken.balanceOf(bob);
        uint256 totalSupplyBefore = hToken.totalSupply();
        uint256 allowanceBefore = hToken.allowance(alice, spender);

        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(address(proxy)),
            address(pausedImplementation),
            hex""
        );

        assertEq(_addressFromSlot(address(proxy), IMPLEMENTATION_SLOT), address(pausedImplementation));

        vm.prank(alice);
        vm.expectRevert(bytes("H_TOKEN_TRANSFERS_PAUSED"));
        hToken.transfer(bob, 1 ether);

        vm.prank(spender);
        vm.expectRevert(bytes("H_TOKEN_TRANSFERS_PAUSED"));
        hToken.transferFrom(alice, bob, 1 ether);

        assertEq(hToken.balanceOf(alice), aliceBalanceBefore);
        assertEq(hToken.balanceOf(bob), bobBalanceBefore);
        assertEq(hToken.totalSupply(), totalSupplyBefore);
        assertEq(hToken.allowance(alice, spender), allowanceBefore);
    }

    function test_pausedImplementationBlocksMintAndBurnToo() public {
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(address(proxy)),
            address(pausedImplementation),
            hex""
        );

        vm.expectRevert(bytes("H_TOKEN_TRANSFERS_PAUSED"));
        hToken.mint(bob, 1 ether);

        vm.expectRevert(bytes("H_TOKEN_TRANSFERS_PAUSED"));
        hToken.burn(alice, 1 ether);
    }

    function _addressFromSlot(address target, bytes32 slot) private view returns (address) {
        return address(uint160(uint256(vm.load(target, slot))));
    }
}
