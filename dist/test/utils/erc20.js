"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploy = void 0;
const hardhat_1 = require("hardhat");
const deploy = async ({ name, symbol, initialAccount, initialAmount, }) => {
    const erc20MockContract = (await hardhat_1.ethers.getContractFactory('contracts/for-test/ERC20ForTest.sol:ERC20ForTest'));
    return await erc20MockContract.deploy(name || 'TestToken', symbol || 'TSTT', initialAccount, initialAmount);
};
exports.deploy = deploy;
