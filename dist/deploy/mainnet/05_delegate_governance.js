"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const deployFunction = async function (hre) {
    const { deployer } = await hre.getNamedAccounts();
    // Keep3r Governance Multisig address
    const keep3rMultisig = '0x0D5Dc686d0a2ABBfDaFDFb4D0533E886517d4E83';
    await hre.deployments.execute('Keep3r', { from: deployer, gasLimit: 100000, log: true }, 'setGovernance', keep3rMultisig);
    await hre.deployments.execute('UniV3PairManagerFactory', { from: deployer, gasLimit: 100000, log: true }, 'setGovernance', keep3rMultisig);
};
deployFunction.tags = ['Governance', 'mainnet'];
exports.default = deployFunction;
