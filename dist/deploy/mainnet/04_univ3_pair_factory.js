"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deployFunction = async function (hre) {
    const { deployer } = await hre.getNamedAccounts();
    const uniV3PairManagerFactory = await hre.deployments.deploy('UniV3PairManagerFactory', {
        contract: 'solidity/contracts/UniV3PairManagerFactory.sol:UniV3PairManagerFactory',
        from: deployer,
        log: true,
    });
};
deployFunction.tags = ['UniV3PairManager', 'UniV3PairManagerFactory', 'mainnet'];
exports.default = deployFunction;
