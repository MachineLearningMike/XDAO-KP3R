"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBalance = exports.deploy = void 0;
const utils_1 = require("ethers/lib/utils");
const hardhat_1 = require("hardhat");
const deploy = async (contract, args) => {
    const deploymentTransactionRequest = await contract.getDeployTransaction(...args);
    const deploymentTx = await contract.signer.sendTransaction(deploymentTransactionRequest);
    const contractAddress = utils_1.getStatic(contract.constructor, 'getContractAddress')(deploymentTx);
    const deployedContract = utils_1.getStatic(contract.constructor, 'getContract')(contractAddress, contract.interface, contract.signer);
    return {
        tx: deploymentTx,
        contract: deployedContract,
    };
};
exports.deploy = deploy;
const setBalance = async (address, amount) => {
    await hardhat_1.network.provider.send('hardhat_setBalance', [address, amount.toHexString()]);
};
exports.setBalance = setBalance;
