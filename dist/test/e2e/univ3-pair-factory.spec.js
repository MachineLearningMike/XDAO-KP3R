"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _utils_1 = require("@utils");
const evm_1 = require("@utils/evm");
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
const common = __importStar(require("./common"));
describe('UniV3PairManagerFactory', () => {
    //factories
    let uniV3PairManagerFactory;
    //contracts
    let uniPairFactory;
    let createdManager;
    //signers
    let governance;
    //misc
    let snapshotId;
    before(async () => {
        await _utils_1.evm.reset({
            jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
            blockNumber: common.FORK_BLOCK_NUMBER,
        });
        [, governance] = await hardhat_1.ethers.getSigners();
        uniV3PairManagerFactory = (await hardhat_1.ethers.getContractFactory('UniV3PairManagerFactory'));
        uniPairFactory = await uniV3PairManagerFactory.connect(governance).deploy();
        snapshotId = await evm_1.snapshot.take();
    });
    beforeEach(async () => {
        await evm_1.snapshot.revert(snapshotId);
    });
    describe('createPairManager', () => {
        let createdManagerAddress;
        beforeEach(async () => {
            await uniPairFactory.createPairManager(common.KP3R_WETH_V3_POOL_ADDRESS);
            createdManagerAddress = await uniPairFactory.callStatic.pairManagers(common.KP3R_WETH_V3_POOL_ADDRESS);
            createdManager = (await hardhat_1.ethers.getContractAt('IUniV3PairManager', createdManagerAddress));
        });
        it('should match the expected address of deployment', async () => {
            const expectedAddress = hardhat_1.ethers.utils.getContractAddress({
                from: uniPairFactory.address,
                nonce: (await hardhat_1.ethers.provider.getTransactionCount(uniPairFactory.address)) - 1,
            });
            chai_1.expect(createdManagerAddress).to.eq(expectedAddress);
        });
        it('should set the governance of the created pair manager to the owner of the factory', async () => {
            chai_1.expect(await createdManager.governance()).to.equal(governance.address);
        });
    });
});
