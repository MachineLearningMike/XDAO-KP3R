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
const _utils_1 = require("@utils");
const bn_1 = require("@utils/bn");
const evm_1 = require("@utils/evm");
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
const moment_1 = __importDefault(require("moment"));
const common = __importStar(require("./common"));
describe('@skip-on-coverage Keep3r', () => {
    let dai;
    let keeper;
    let keep3r;
    let keep3rV1;
    let keep3rV1Proxy;
    let keep3rV1ProxyGovernance;
    let snapshotId;
    before(async () => {
        dai = (await hardhat_1.ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.DAI_ADDRESS));
        await _utils_1.evm.reset({
            jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
            blockNumber: common.FORK_BLOCK_NUMBER,
        });
        ({ keep3r, keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance } = await common.setupKeep3r());
        keeper = await _utils_1.wallet.impersonate(common.RICH_ETH_DAI_ADDRESS);
        snapshotId = await evm_1.snapshot.take();
    });
    beforeEach(async () => {
        await evm_1.snapshot.revert(snapshotId);
    });
    it('should fail to activate before 3 days', async () => {
        // bond and activate
        await keep3r.connect(keeper).bond(keep3rV1.address, 0);
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds') - 60);
        await chai_1.expect(keep3r.connect(keeper).activate(keep3rV1.address)).to.be.revertedWith('BondsLocked()');
    });
    it('should fail to withdraw funds without waiting 3 days after unbond', async () => {
        // bond and activate
        await keep3r.connect(keeper).bond(keep3rV1.address, 0);
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds'));
        await keep3r.connect(keeper).activate(keep3rV1.address);
        // unbond and withdraw
        await keep3r.connect(keeper).unbond(keep3rV1.address, 0);
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds') - 60);
        await chai_1.expect(keep3r.connect(keeper).withdraw(keep3rV1.address)).to.be.revertedWith('UnbondsLocked()');
    });
    it('should be able to bond KP3R tokens', async () => {
        // send some KP3R to keeper
        await keep3rV1Proxy.connect(keep3rV1ProxyGovernance)['mint(address,uint256)'](keeper._address, bn_1.toUnit(1));
        // bond and activate
        await keep3rV1.connect(keeper).approve(keep3r.address, bn_1.toUnit(1));
        await keep3r.connect(keeper).bond(keep3rV1.address, bn_1.toUnit(1));
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds'));
        await keep3r.connect(keeper).activate(keep3rV1.address);
        chai_1.expect(await keep3rV1.balanceOf(keeper._address)).to.equal(0);
        chai_1.expect(await keep3r.bonds(keeper._address, keep3rV1.address)).to.equal(bn_1.toUnit(1));
        chai_1.expect(await keep3r.callStatic.isKeeper(keeper._address)).to.be.true;
    });
    it('should be able to bond any ERC20 tokens', async () => {
        // bond and activate
        await dai.connect(keeper).approve(keep3r.address, bn_1.toUnit(1));
        await keep3r.connect(keeper).bond(dai.address, bn_1.toUnit(1));
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds'));
        await keep3r.connect(keeper).activate(dai.address);
        chai_1.expect(await dai.balanceOf(keep3r.address)).to.equal(bn_1.toUnit(1));
        chai_1.expect(await keep3r.bonds(keeper._address, dai.address)).to.equal(bn_1.toUnit(1));
        chai_1.expect(await keep3r.callStatic.isKeeper(keeper._address)).to.be.true;
    });
});
