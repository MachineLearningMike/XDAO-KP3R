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
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3r', () => {
    let governance;
    let keep3r;
    let helper;
    let keep3rV1;
    let keep3rV1Proxy;
    let kp3rWethPool;
    let keep3rFactory;
    before(async () => {
        [governance] = await hardhat_1.ethers.getSigners();
        keep3rFactory = await smock_1.smock.mock('Keep3rForTest');
    });
    beforeEach(async () => {
        helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        kp3rWethPool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
    });
    beforeEach(async () => {
        helper.isKP3RToken0.whenCalledWith(kp3rWethPool.address).returns(true);
        keep3r = await keep3rFactory.deploy(governance.address, helper.address, keep3rV1.address, keep3rV1Proxy.address, kp3rWethPool.address);
    });
    it('should be connected to Keep3r Helper', async () => {
        chai_1.expect(await keep3r.keep3rHelper()).to.be.equal(helper.address);
    });
    it('should be connected to Keep3r V1', async () => {
        chai_1.expect(await keep3r.keep3rV1()).to.be.equal(keep3rV1.address);
    });
    it('should be connected to Keep3r V1 Proxy', async () => {
        chai_1.expect(await keep3r.keep3rV1Proxy()).to.be.equal(keep3rV1Proxy.address);
    });
    it('should be connected to KP3R/WETH oracle pool', async () => {
        chai_1.expect(await keep3r.kp3rWethPool()).to.be.equal(kp3rWethPool.address);
    });
    it('should store the token order from the KP3R/WETH oracle pool', async () => {
        chai_1.expect(await keep3r.viewTickOrder(kp3rWethPool.address)).to.be.true;
    });
    it('should set deployer as governance', async () => {
        chai_1.expect(await keep3r.governance()).to.be.equal(governance.address);
    });
});
