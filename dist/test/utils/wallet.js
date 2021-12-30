"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomAddress = exports.generateRandomWithEth = exports.generateRandom = exports.impersonate = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const hardhat_1 = require("hardhat");
const web3_utils_1 = require("web3-utils");
const impersonate = async (address) => {
    await hardhat_1.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address],
    });
    return hardhat_1.ethers.provider.getSigner(address);
};
exports.impersonate = impersonate;
const generateRandom = async () => {
    return (await ethers_1.Wallet.createRandom()).connect(hardhat_1.ethers.provider);
};
exports.generateRandom = generateRandom;
const generateRandomWithEth = async (amount) => {
    const [governance] = await hardhat_1.ethers.getSigners();
    const wallet = await exports.generateRandom();
    await governance.sendTransaction({ to: wallet.address, value: amount });
    return wallet;
};
exports.generateRandomWithEth = generateRandomWithEth;
const generateRandomAddress = () => {
    return utils_1.getAddress(web3_utils_1.randomHex(20));
};
exports.generateRandomAddress = generateRandomAddress;
