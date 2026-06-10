// test/Distribution.ts
//
// End-to-end test of the full distribution pipeline:
//   1. A source token accumulates real transfer history (mints, transfers,
//      burns, emptied accounts).
//   2. scripts/lib/snapshot.ts reconstructs balances at a snapshot block and
//      must ignore everything that happens after that block.
//   3. scripts/lib/merkle.ts builds the claim tree from the snapshot.
//   4. A fresh token + MerkleDistributor are deployed, the treasury mints and
//      funds the distributor, and every holder claims.
//   5. Final balances must equal the snapshot exactly.

import { expect } from "chai";
import { ignition, ethers } from "hardhat";
import HTokenModule from "../ignition/modules/HToken";
import { buildSnapshot } from "../scripts/lib/snapshot";
import { buildTree, exportClaims, verifyTreeDeterminism } from "../scripts/lib/merkle";

describe("Distribution pipeline", function () {
  it("snapshot -> merkle tree -> new token -> claims reconcile exactly", async function () {
    const [treasury, alice, bob, carol, dave, excludedHolder] =
      await ethers.getSigners();
    // A passive recipient with no private key activity - receives only.
    const passive = ethers.Wallet.createRandom().address;

    // ---- 1. Source token with real history ----
    const { hToken: sourceToken } = await ignition.deploy(HTokenModule, {
      parameters: { HTokenModule: { multisig: await treasury.getAddress() } },
    });

    await sourceToken.mint(await alice.getAddress(), ethers.parseEther("1000"));
    await sourceToken.mint(await bob.getAddress(), ethers.parseEther("500"));
    await sourceToken.mint(await carol.getAddress(), ethers.parseEther("42.5"));
    await sourceToken.mint(await dave.getAddress(), ethers.parseEther("7"));
    await sourceToken.mint(await excludedHolder.getAddress(), ethers.parseEther("66"));

    // Transfers, including one to a passive address and one emptying account.
    await sourceToken.connect(alice).transfer(passive, ethers.parseEther("100"));
    await sourceToken.connect(bob).transfer(await carol.getAddress(), ethers.parseEther("0.000000000000000001"));
    // Dave sends everything away - he must NOT appear in the snapshot.
    await sourceToken.connect(dave).transfer(await alice.getAddress(), ethers.parseEther("7"));
    // A burn shrinks supply and must be accounted for.
    await sourceToken.burn(await carol.getAddress(), ethers.parseEther("2"));

    const snapshotBlock = await ethers.provider.getBlockNumber();

    // ---- Post-snapshot activity that the snapshot must ignore ----
    await sourceToken.mint(await dave.getAddress(), ethers.parseEther("9999"));
    await sourceToken.connect(alice).transfer(await bob.getAddress(), ethers.parseEther("50"));

    // ---- 2. Snapshot at the fixed block ----
    const snapshot = await buildSnapshot(
      ethers.provider,
      await sourceToken.getAddress(),
      snapshotBlock,
      { excludeAddresses: [await excludedHolder.getAddress()] }
    );

    // Expected balances at the snapshot block.
    const expected: Record<string, bigint> = {
      [await alice.getAddress()]: ethers.parseEther("907"), // 1000 - 100 + 7
      [await bob.getAddress()]: ethers.parseEther("500") - 1n,
      [await carol.getAddress()]: ethers.parseEther("40.5") + 1n, // 42.5 + 1 wei - 2
      [passive]: ethers.parseEther("100"),
    };

    expect(snapshot.holderCount).to.equal(4);
    for (const [address, amount] of Object.entries(expected)) {
      expect(snapshot.holders[ethers.getAddress(address)]).to.equal(
        amount.toString(),
        `snapshot balance for ${address}`
      );
    }
    // Dave emptied his account before the block - he must be absent.
    expect(snapshot.holders[await dave.getAddress()]).to.equal(undefined);
    // The excluded holder is reported separately, never distributed.
    expect(snapshot.excluded[await excludedHolder.getAddress()]).to.equal(
      ethers.parseEther("66").toString()
    );
    // Conservation: holders + excluded == total supply at the block.
    expect(
      BigInt(snapshot.holdersTotal) + BigInt(snapshot.excludedTotal)
    ).to.equal(BigInt(snapshot.totalSupply));

    // ---- 3. Merkle tree from the snapshot ----
    const tree = buildTree(snapshot.holders);
    verifyTreeDeterminism(snapshot.holders, tree.root);
    const { root, claims } = exportClaims(tree);
    expect(Object.keys(claims).length).to.equal(snapshot.holderCount);

    // ---- 4. Fresh token + distributor, treasury mints and funds ----
    const implementationFactory = await ethers.getContractFactory("HToken");
    const implementation = await implementationFactory.deploy();
    const proxyFactory = await ethers.getContractFactory(
      "TransparentUpgradeableProxy"
    );
    const initData = implementation.interface.encodeFunctionData("initialize", [
      await treasury.getAddress(),
    ]);
    const proxy = await proxyFactory.deploy(
      await implementation.getAddress(),
      await treasury.getAddress(),
      initData
    );
    const newToken = await ethers.getContractAt("HToken", await proxy.getAddress());

    const distributorFactory = await ethers.getContractFactory("MerkleDistributor");
    const distributor = await distributorFactory.deploy(
      await newToken.getAddress(),
      root,
      await treasury.getAddress()
    );

    // Single mint of the full supply to the treasury, then fund the
    // distributor with exactly the holders' total.
    await newToken.mint(await treasury.getAddress(), BigInt(snapshot.totalSupply));
    await newToken
      .connect(treasury)
      .transfer(await distributor.getAddress(), BigInt(snapshot.holdersTotal));

    // ---- 5. Every holder claims; balances must equal the snapshot ----
    for (const [address, { amount, proof }] of Object.entries(claims)) {
      await distributor.claim(address, amount, proof);
    }
    for (const [address, amount] of Object.entries(snapshot.holders)) {
      expect(await newToken.balanceOf(address)).to.equal(
        BigInt(amount),
        `claimed balance for ${address}`
      );
    }

    // The distributor is fully drained - funding matched claims exactly.
    expect(await newToken.balanceOf(await distributor.getAddress())).to.equal(0n);
    // The excluded allocation never left the treasury.
    expect(await newToken.balanceOf(await treasury.getAddress())).to.equal(
      BigInt(snapshot.excludedTotal)
    );
    // Double claims stay impossible after full distribution.
    const firstHolder = Object.keys(claims)[0];
    await expect(
      distributor.claim(
        firstHolder,
        claims[firstHolder].amount,
        claims[firstHolder].proof
      )
    ).to.be.revertedWithCustomError(distributor, "AlreadyClaimed");
  });

  it("snapshot fails loudly if the holder set does not reconcile", async function () {
    const [treasury, alice] = await ethers.getSigners();
    const { hToken } = await ignition.deploy(HTokenModule, {
      parameters: { HTokenModule: { multisig: await treasury.getAddress() } },
    });
    await hToken.mint(await alice.getAddress(), 1000n);
    const block = await ethers.provider.getBlockNumber();

    // Scanning from a block AFTER the mint loses the Transfer log, so the
    // conservation check must throw instead of producing a silent bad snapshot.
    await hToken.mint(await alice.getAddress(), 5n); // advance the chain
    await expect(
      buildSnapshot(ethers.provider, await hToken.getAddress(), block + 1, {
        fromBlock: block + 1,
      })
    ).to.be.rejectedWith(/conservation check failed/);
  });
});
