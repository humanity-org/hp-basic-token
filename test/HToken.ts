// test/HToken.ts
//
// Tests for the HToken contract deployed through its Ignition module,
// exactly as it deploys to a live network: implementation behind a
// TransparentUpgradeableProxy, initialized atomically in the proxy
// constructor with the multisig as owner.

import { expect } from "chai";
import { ignition, ethers } from "hardhat";
import HTokenModule from "../ignition/modules/HToken";

// EIP-1967 storage slots.
const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

describe("HToken", function () {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const { proxy, proxyAdmin, hToken } = await ignition.deploy(HTokenModule, {
      parameters: { HTokenModule: { multisig: await owner.getAddress() } },
    });
    return { owner, alice, bob, proxy, proxyAdmin, hToken };
  }

  describe("deployment", function () {
    it("sets name, symbol, decimals and zero initial supply", async function () {
      const { hToken } = await deploy();
      expect(await hToken.name()).to.equal("Humanity");
      expect(await hToken.symbol()).to.equal("H");
      expect(await hToken.decimals()).to.equal(18);
      expect(await hToken.totalSupply()).to.equal(0);
    });

    it("sets the multisig as token owner", async function () {
      const { hToken, owner } = await deploy();
      expect(await hToken.owner()).to.equal(await owner.getAddress());
    });

    it("sets the multisig as ProxyAdmin owner", async function () {
      const { proxyAdmin, owner } = await deploy();
      expect(await proxyAdmin.owner()).to.equal(await owner.getAddress());
    });

    it("wires the EIP-1967 admin slot to the ProxyAdmin", async function () {
      const { proxy, proxyAdmin } = await deploy();
      const adminSlot = await ethers.provider.getStorage(proxy, ADMIN_SLOT);
      const admin = ethers.getAddress(ethers.dataSlice(adminSlot, 12));
      expect(admin).to.equal(await proxyAdmin.getAddress());
    });

    it("cannot be initialized again through the proxy", async function () {
      const { hToken, alice } = await deploy();
      await expect(
        hToken.initialize(await alice.getAddress())
      ).to.be.revertedWithCustomError(hToken, "InvalidInitialization");
    });

    it("cannot initialize the implementation contract directly", async function () {
      const { proxy, alice } = await deploy();
      const implementationSlot = await ethers.provider.getStorage(
        proxy,
        IMPLEMENTATION_SLOT
      );
      const implementationAddress = ethers.getAddress(
        ethers.dataSlice(implementationSlot, 12)
      );
      const implementation = await ethers.getContractAt(
        "HToken",
        implementationAddress
      );
      await expect(
        implementation.initialize(await alice.getAddress())
      ).to.be.revertedWithCustomError(implementation, "InvalidInitialization");
    });
  });

  describe("mint", function () {
    it("lets the owner mint and updates supply", async function () {
      const { hToken, alice } = await deploy();
      await expect(hToken.mint(await alice.getAddress(), 1000n))
        .to.emit(hToken, "Transfer")
        .withArgs(ethers.ZeroAddress, await alice.getAddress(), 1000n);
      expect(await hToken.balanceOf(await alice.getAddress())).to.equal(1000n);
      expect(await hToken.totalSupply()).to.equal(1000n);
    });

    it("rejects mint from a non-owner", async function () {
      const { hToken, alice } = await deploy();
      await expect(
        hToken.connect(alice).mint(await alice.getAddress(), 1n)
      ).to.be.revertedWithCustomError(hToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("burn", function () {
    it("lets the owner burn and updates supply", async function () {
      const { hToken, alice } = await deploy();
      await hToken.mint(await alice.getAddress(), 1000n);
      await expect(hToken.burn(await alice.getAddress(), 400n))
        .to.emit(hToken, "Transfer")
        .withArgs(await alice.getAddress(), ethers.ZeroAddress, 400n);
      expect(await hToken.balanceOf(await alice.getAddress())).to.equal(600n);
      expect(await hToken.totalSupply()).to.equal(600n);
    });

    it("rejects burn from a non-owner", async function () {
      const { hToken, alice } = await deploy();
      await hToken.mint(await alice.getAddress(), 1000n);
      await expect(
        hToken.connect(alice).burn(await alice.getAddress(), 1n)
      ).to.be.revertedWithCustomError(hToken, "OwnableUnauthorizedAccount");
    });

    it("rejects burning more than the balance", async function () {
      const { hToken, alice } = await deploy();
      await hToken.mint(await alice.getAddress(), 10n);
      await expect(
        hToken.burn(await alice.getAddress(), 11n)
      ).to.be.revertedWithCustomError(hToken, "ERC20InsufficientBalance");
    });
  });

  describe("transfers", function () {
    it("supports transfer and transferFrom", async function () {
      const { hToken, alice, bob } = await deploy();
      await hToken.mint(await alice.getAddress(), 1000n);
      await hToken.connect(alice).transfer(await bob.getAddress(), 300n);
      expect(await hToken.balanceOf(await bob.getAddress())).to.equal(300n);

      await hToken.connect(bob).approve(await alice.getAddress(), 100n);
      await hToken
        .connect(alice)
        .transferFrom(await bob.getAddress(), await alice.getAddress(), 100n);
      expect(await hToken.balanceOf(await bob.getAddress())).to.equal(200n);
      expect(await hToken.balanceOf(await alice.getAddress())).to.equal(800n);
    });
  });

  describe("ownership", function () {
    it("transfers ownership and revokes the previous owner's powers", async function () {
      const { hToken, owner, alice, bob } = await deploy();
      await hToken.transferOwnership(await alice.getAddress());
      expect(await hToken.owner()).to.equal(await alice.getAddress());
      await expect(
        hToken.connect(owner).mint(await bob.getAddress(), 1n)
      ).to.be.revertedWithCustomError(hToken, "OwnableUnauthorizedAccount");
      await hToken.connect(alice).mint(await bob.getAddress(), 1n);
      expect(await hToken.balanceOf(await bob.getAddress())).to.equal(1n);
    });
  });

  describe("upgrade path", function () {
    it("upgrades through the ProxyAdmin and preserves state", async function () {
      const { hToken, proxy, proxyAdmin, owner, alice } = await deploy();
      await hToken.mint(await alice.getAddress(), 12345n);

      const upgradeFactory = await ethers.getContractFactory("HTokenUpgrade");
      const newImplementation = await upgradeFactory.deploy();
      await proxyAdmin
        .connect(owner)
        .upgradeAndCall(proxy, await newImplementation.getAddress(), "0x");

      const upgraded = await ethers.getContractAt(
        "HTokenUpgrade",
        await proxy.getAddress()
      );
      // State survives the upgrade; the new function is callable.
      expect(await upgraded.balanceOf(await alice.getAddress())).to.equal(12345n);
      expect(await upgraded.owner()).to.equal(await owner.getAddress());
      await expect(upgraded.test()).to.emit(upgraded, "TestEvent");
    });

    it("rejects upgrades from a non-owner of the ProxyAdmin", async function () {
      const { proxy, proxyAdmin, alice } = await deploy();
      const upgradeFactory = await ethers.getContractFactory("HTokenUpgrade");
      const newImplementation = await upgradeFactory.deploy();
      await expect(
        proxyAdmin
          .connect(alice)
          .upgradeAndCall(proxy, await newImplementation.getAddress(), "0x")
      ).to.be.revertedWithCustomError(proxyAdmin, "OwnableUnauthorizedAccount");
    });
  });
});
