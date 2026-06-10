// test/MerkleDistributor.ts
//
// Tests for the MerkleDistributor contract. The trees are built with the
// same library (scripts/lib/merkle.ts) used in production, so these tests
// also prove that the off-chain leaf encoding matches the on-chain one.

import { expect } from "chai";
import { ignition, ethers } from "hardhat";
import HTokenModule from "../ignition/modules/HToken";
import MerkleDistributorModule from "../ignition/modules/MerkleDistributor";
import { buildTree, exportClaims } from "../scripts/lib/merkle";

describe("MerkleDistributor", function () {
  async function deploy() {
    const [owner, alice, bob, carol, stranger] = await ethers.getSigners();
    const { hToken } = await ignition.deploy(HTokenModule, {
      parameters: { HTokenModule: { multisig: await owner.getAddress() } },
    });

    // Allocations for three claimants, including a zero-amount edge case later.
    const allocations: Record<string, string> = {
      [await alice.getAddress()]: "1000",
      [await bob.getAddress()]: "2500",
      [await carol.getAddress()]: "1",
    };
    const tree = buildTree(allocations);
    const { root, claims } = exportClaims(tree);

    const distributorFactory = await ethers.getContractFactory("MerkleDistributor");
    const distributor = await distributorFactory.deploy(
      await hToken.getAddress(),
      root,
      await owner.getAddress()
    );

    // Fund the distributor with the exact total of all allocations.
    await hToken.mint(await distributor.getAddress(), 3501n);

    return { owner, alice, bob, carol, stranger, hToken, distributor, root, claims };
  }

  describe("construction", function () {
    it("stores the token, root and owner", async function () {
      const { distributor, hToken, root, owner } = await deploy();
      expect(await distributor.token()).to.equal(await hToken.getAddress());
      expect(await distributor.merkleRoot()).to.equal(root);
      expect(await distributor.owner()).to.equal(await owner.getAddress());
    });

    it("deploys through the Ignition module with parameters", async function () {
      const { hToken, root, owner } = await deploy();
      const { distributor } = await ignition.deploy(MerkleDistributorModule, {
        parameters: {
          MerkleDistributorModule: {
            token: await hToken.getAddress(),
            merkleRoot: root,
            owner: await owner.getAddress(),
          },
        },
      });
      expect(await distributor.token()).to.equal(await hToken.getAddress());
      expect(await distributor.merkleRoot()).to.equal(root);
      expect(await distributor.owner()).to.equal(await owner.getAddress());
    });
  });

  describe("claim", function () {
    it("pays out a valid claim and marks it claimed", async function () {
      const { distributor, hToken, alice, claims } = await deploy();
      const address = await alice.getAddress();
      const { amount, proof } = claims[address];
      await expect(distributor.connect(alice).claim(address, amount, proof))
        .to.emit(distributor, "Claimed")
        .withArgs(address, amount);
      expect(await hToken.balanceOf(address)).to.equal(BigInt(amount));
      expect(await distributor.hasClaimed(address)).to.equal(true);
    });

    it("lets a third party claim for an account, tokens go to the account", async function () {
      const { distributor, hToken, bob, stranger, claims } = await deploy();
      const address = await bob.getAddress();
      const { amount, proof } = claims[address];
      await distributor.connect(stranger).claim(address, amount, proof);
      expect(await hToken.balanceOf(address)).to.equal(BigInt(amount));
      expect(await hToken.balanceOf(await stranger.getAddress())).to.equal(0n);
    });

    it("rejects a second claim for the same account", async function () {
      const { distributor, alice, claims } = await deploy();
      const address = await alice.getAddress();
      const { amount, proof } = claims[address];
      await distributor.claim(address, amount, proof);
      await expect(distributor.claim(address, amount, proof))
        .to.be.revertedWithCustomError(distributor, "AlreadyClaimed")
        .withArgs(address);
    });

    it("rejects a claim with the wrong amount", async function () {
      const { distributor, alice, claims } = await deploy();
      const address = await alice.getAddress();
      const { proof } = claims[address];
      await expect(
        distributor.claim(address, 999999n, proof)
      ).to.be.revertedWithCustomError(distributor, "InvalidProof");
    });

    it("rejects a claim for an account not in the tree", async function () {
      const { distributor, stranger, alice, claims } = await deploy();
      const { amount, proof } = claims[await alice.getAddress()];
      await expect(
        distributor.claim(await stranger.getAddress(), amount, proof)
      ).to.be.revertedWithCustomError(distributor, "InvalidProof");
    });

    it("rejects a claim with a tampered proof", async function () {
      const { distributor, alice, claims } = await deploy();
      const address = await alice.getAddress();
      const { amount, proof } = claims[address];
      const tampered = [...proof];
      tampered[0] = ethers.keccak256("0x1234");
      await expect(
        distributor.claim(address, amount, tampered)
      ).to.be.revertedWithCustomError(distributor, "InvalidProof");
    });

    it("rejects a claim when the distributor is underfunded", async function () {
      const { distributor, hToken, owner, alice, claims } = await deploy();
      // Drain the distributor first.
      await distributor
        .connect(owner)
        .withdraw(await owner.getAddress(), 3501n);
      const address = await alice.getAddress();
      const { amount, proof } = claims[address];
      await expect(
        distributor.claim(address, amount, proof)
      ).to.be.revertedWithCustomError(hToken, "ERC20InsufficientBalance");
    });

    it("handles every claimant claiming, leaving an empty distributor", async function () {
      const { distributor, hToken, claims } = await deploy();
      for (const [address, { amount, proof }] of Object.entries(claims)) {
        await distributor.claim(address, amount, proof);
        expect(await hToken.balanceOf(address)).to.equal(BigInt(amount));
      }
      expect(await hToken.balanceOf(await distributor.getAddress())).to.equal(0n);
    });
  });

  describe("withdraw", function () {
    it("lets the owner withdraw held tokens", async function () {
      const { distributor, hToken, owner } = await deploy();
      const to = await owner.getAddress();
      await expect(distributor.connect(owner).withdraw(to, 500n))
        .to.emit(distributor, "Withdrawn")
        .withArgs(to, 500n);
      expect(await hToken.balanceOf(to)).to.equal(500n);
    });

    it("rejects withdraw from a non-owner", async function () {
      const { distributor, alice } = await deploy();
      await expect(
        distributor.connect(alice).withdraw(await alice.getAddress(), 1n)
      ).to.be.revertedWithCustomError(distributor, "OwnableUnauthorizedAccount");
    });
  });
});
