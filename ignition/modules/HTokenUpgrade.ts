import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HTokenUpgradeModule = buildModule("HTokenUpgradeModule", (m) => {
    // const { proxyAdmin, proxy, hToken } = m.useModule(HTokenModule)
    // const proxyAdminOwner = m.staticCall(hToken, "owner", [])
    const hTokenUpgradeImplementation = m.contract("HTokenUpgrade", [], { id: "HTokenUpgradeImplementation"})
    // const encodeFunctionCall = m.encodeFunctionCall(hTokenUpgradeImplementation, "test", [])
    // m.call(proxyAdmin, "upgradeAndCall", [hToken, hTokenUpgradeImplementation, encodeFunctionCall])
    // const hTokenUpgrade = m.contractAt("HTokenUpgrade", hToken.address)
    // return { hTokenUpgrade, proxyAdmin, proxy, hToken }
    return { hTokenUpgradeImplementation }
})

export default HTokenUpgradeModule