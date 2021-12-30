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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const smock_1 = require("@defi-wonderland/smock");
const IUniswapV3PoolForTest_json_1 = __importDefault(require("@solidity/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json"));
const IKeep3rV1_json_1 = __importDefault(require("@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json"));
const IKeep3rV1Proxy_json_1 = __importDefault(require("@solidity/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json"));
const IKeep3rHelper_json_1 = __importDefault(require("@solidity/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json"));
const _utils_1 = require("@utils");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rJobManager', () => {
    const randomJob = _utils_1.wallet.generateRandomAddress();
    let randomUser;
    let jobManager;
    let jobManagerFactory;
    let oraclePool;
    before(async () => {
        [, randomUser] = await hardhat_1.ethers.getSigners();
        jobManagerFactory = await smock_1.smock.mock('Keep3rJobManagerForTest');
    });
    beforeEach(async () => {
        const helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        const keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        const keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        oraclePool.token0.returns(keep3rV1.address);
        jobManager = await jobManagerFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
    });
    describe('addJob', () => {
        it('should not allow adding the same job twice', async () => {
            await jobManager.connect(randomUser).addJob(randomJob);
            await chai_1.expect(jobManager.connect(randomUser).addJob(randomJob)).to.be.revertedWith('JobAlreadyAdded()');
        });
        it('should revert if caller has bonded funds', async () => {
            await jobManager.setVariable('hasBonded', {
                [randomJob]: true,
            });
            await chai_1.expect(jobManager.connect(randomUser).addJob(randomJob)).to.be.revertedWith('AlreadyAKeeper()');
        });
        it('should set sender as job owner', async () => {
            await jobManager.connect(randomUser).addJob(randomJob);
            chai_1.expect(await jobManager.jobOwner(randomJob)).to.equal(randomUser.address);
        });
        it('should emit event', async () => {
            await chai_1.expect(jobManager.connect(randomUser).addJob(randomJob)).to.emit(jobManager, 'JobAddition').withArgs(randomUser.address, randomJob);
        });
    });
});
