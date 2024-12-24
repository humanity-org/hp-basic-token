import { expect } from "chai";
import { ignition, ethers } from "hardhat";

import BMTokenModule from "../ignition/modules/BMToken";
import BMTokenUpgradeModule from "../ignition/modules/BMTokenUpgrade";

describe("BMToken", function () {
  describe("Deployment", async function () {
    it("Should properly work", async function () {
      const [signer0, signer1] = await ethers.getSigners();
      const { proxy, proxyAdmin, bmToken } = await ignition.deploy(
        BMTokenModule,
        {
          parameters: {
            BMTokenModule: { multisig: await signer0.getAddress() },
          },
        }
      );
      await bmToken.mint(await signer1.getAddress(), 2);
      let balance = await bmToken.balanceOf(await signer1.getAddress());
      expect(balance).equal(2);
      await bmToken.burn(await signer1.getAddress(), 1);
      balance = await bmToken.balanceOf(await signer1.getAddress());
      expect(balance).equal(1);
      // const { bmTokenUpgrade } = await ignition.deploy(BMTokenUpgradeModule, { parameters: { BMTokenModule: { multisig: await signer0.getAddress() }}})
      // await bmTokenUpgrade.test()
    });
  });
});
