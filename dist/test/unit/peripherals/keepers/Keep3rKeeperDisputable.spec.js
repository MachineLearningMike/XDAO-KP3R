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
const behaviours_1 = require("@utils/behaviours");
const bn_1 = require("@utils/bn");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rKeeperDisputable', () => {
    const randomKeeper = _utils_1.wallet.generateRandomAddress();
    let governance;
    let slasher;
    let disputer;
    let keeperDisputable;
    let helper;
    let keep3rV1;
    let keep3rV1Proxy;
    let oraclePool;
    let keeperDisputableFactory;
    before(async () => {
        [governance, slasher, disputer] = await hardhat_1.ethers.getSigners();
        keeperDisputableFactory = await smock_1.smock.mock('Keep3rKeeperDisputableForTest');
    });
    beforeEach(async () => {
        helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        oraclePool.token0.returns(keep3rV1.address);
        keeperDisputable = await keeperDisputableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
        await keeperDisputable.setVariable('slashers', { [slasher.address]: true });
        await keeperDisputable.setVariable('disputers', { [disputer.address]: true });
    });
    describe('slash', () => {
        behaviours_1.onlySlasher(() => keeperDisputable, 'slash', [slasher], () => [randomKeeper, keeperDisputable.address, 1]);
        beforeEach(async () => {
            keep3rV1.transfer.returns(true);
            keep3rV1.transferFrom.returns(true);
            await keeperDisputable.setVariable('bonds', {
                [randomKeeper]: { [keep3rV1.address]: bn_1.toUnit(3) },
            });
            await keeperDisputable.connect(disputer).dispute(randomKeeper);
        });
        it('should revert if keeper is not disputed', async () => {
            const undisputedKeeper = _utils_1.wallet.generateRandomAddress();
            await chai_1.expect(keeperDisputable.connect(slasher).slash(undisputedKeeper, keep3rV1.address, bn_1.toUnit(0.123))).to.be.revertedWith('NotDisputed()');
        });
        it('should emit event', async () => {
            await chai_1.expect(keeperDisputable.connect(slasher).slash(randomKeeper, keep3rV1.address, bn_1.toUnit(0.123)))
                .to.emit(keeperDisputable, 'KeeperSlash')
                .withArgs(randomKeeper, slasher.address, bn_1.toUnit(0.123));
        });
        it('should slash specified bond amount', async () => {
            await keeperDisputable.connect(slasher).slash(randomKeeper, keep3rV1.address, bn_1.toUnit(2));
            chai_1.expect(await keeperDisputable.bonds(randomKeeper, keep3rV1.address)).to.equal(bn_1.toUnit(1));
        });
    });
    describe('revoke', () => {
        behaviours_1.onlySlasher(() => keeperDisputable, 'revoke', [slasher], [randomKeeper]);
        beforeEach(async () => {
            await keeperDisputable.setKeeper(randomKeeper);
        });
        it('should revert if keeper was not disputed', async () => {
            await chai_1.expect(keeperDisputable.connect(slasher).revoke(randomKeeper)).to.be.revertedWith('NotDisputed()');
        });
        context('when keeper was disputed', () => {
            beforeEach(async () => {
                await keeperDisputable.connect(disputer).dispute(randomKeeper);
            });
            it('should remove keeper', async () => {
                await keeperDisputable.connect(slasher).revoke(randomKeeper);
                chai_1.expect(await keeperDisputable.isKeeper(randomKeeper)).to.equal(false);
            });
            it('should keep keeper disputed', async () => {
                await keeperDisputable.connect(slasher).revoke(randomKeeper);
                chai_1.expect(await keeperDisputable.disputes(randomKeeper)).to.equal(true);
            });
            it('should emit event', async () => {
                await chai_1.expect(keeperDisputable.connect(slasher).revoke(randomKeeper))
                    .to.emit(keeperDisputable, 'KeeperRevoke')
                    .withArgs(randomKeeper, slasher.address);
            });
            it('should slash all keeper KP3R bonds', async () => {
                await keeperDisputable.setVariable('bonds', {
                    [randomKeeper]: { [keep3rV1.address]: bn_1.toUnit(1) },
                });
                await keeperDisputable.connect(slasher).revoke(randomKeeper);
                chai_1.expect(await keeperDisputable.bonds(randomKeeper, keep3rV1.address)).to.equal(bn_1.toUnit(0));
            });
        });
    });
    describe('internal slash', () => {
        context('when using an ERC20 bond', () => {
            let erc20Factory;
            let erc20;
            before(async () => {
                erc20Factory = await smock_1.smock.mock('ERC20ForTest');
            });
            beforeEach(async () => {
                erc20 = await erc20Factory.deploy('Sample', 'SMP', keeperDisputable.address, bn_1.toUnit(2));
                await keeperDisputable.setVariable('bonds', {
                    [randomKeeper]: { [erc20.address]: bn_1.toUnit(2) },
                });
                erc20.transfer.returns(true);
            });
            it('should not revert if transfer fails', async () => {
                erc20.transfer.reverts();
                await chai_1.expect(keeperDisputable.internalSlash(randomKeeper, erc20.address, bn_1.toUnit(1))).not.to.be.reverted;
            });
            it('should transfer tokens to governance', async () => {
                await keeperDisputable.internalSlash(randomKeeper, erc20.address, bn_1.toUnit(1));
                chai_1.expect(erc20.transfer).to.be.calledOnceWith(governance.address, bn_1.toUnit(1));
            });
            it('should reduce keeper bonds', async () => {
                await keeperDisputable.internalSlash(randomKeeper, erc20.address, bn_1.toUnit(1));
                chai_1.expect(await keeperDisputable.bonds(randomKeeper, erc20.address)).to.equal(bn_1.toUnit(1));
            });
        });
        context('when using a KP3R bond', () => {
            beforeEach(async () => {
                await keeperDisputable.setVariable('bonds', {
                    [randomKeeper]: { [keep3rV1.address]: bn_1.toUnit(2) },
                });
            });
            it('should reduce keeper bonds', async () => {
                await keeperDisputable.internalSlash(randomKeeper, keep3rV1.address, bn_1.toUnit(1));
                chai_1.expect(await keeperDisputable.bonds(randomKeeper, keep3rV1.address)).to.equal(bn_1.toUnit(1));
            });
        });
        it('should not remove the dispute from the keeper', async () => {
            await keeperDisputable.connect(disputer).dispute(randomKeeper);
            await keeperDisputable.internalSlash(randomKeeper, keep3rV1.address, 0);
            chai_1.expect(await keeperDisputable.disputes(randomKeeper)).to.equal(true);
        });
    });
});
