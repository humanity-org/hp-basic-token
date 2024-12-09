import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import BMTokenModule from "./BMToken";

const BMTokenUpgradeModule = buildModule("BMTokenUpgradeModule", (m) => {
    const { proxyAdmin, proxy, bmToken } = m.useModule(BMTokenModule)
    const proxyAdminOwner = m.staticCall(bmToken, "owner", [])
    const bmTokenUpgradeImplementation = m.contract("BMTokenUpgrade", [], { id: "BMTokenUpgradeImplementation"})
    const encodeFunctionCall = m.encodeFunctionCall(bmTokenUpgradeImplementation, "test", [])
    m.call(proxyAdmin, "upgradeAndCall", [bmToken, bmTokenUpgradeImplementation, encodeFunctionCall])
    const bmTokenUpgrade = m.contractAt("BMTokenUpgrade", bmToken.address)
    return { bmTokenUpgrade, proxyAdmin, proxy, bmToken }
})

export default BMTokenUpgradeModule