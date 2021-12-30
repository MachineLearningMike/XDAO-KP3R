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
const IUniswapV3Pool_json_1 = __importDefault(require("@artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json"));
const smock_1 = require("@defi-wonderland/smock");
const bignumber_1 = require("@ethersproject/bignumber");
const IKeep3rV1_json_1 = __importDefault(require("@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json"));
const IKeep3r_json_1 = __importDefault(require("@solidity/interfaces/IKeep3r.sol/IKeep3r.json"));
const _utils_1 = require("@utils");
const bn_1 = require("@utils/bn");
const math_1 = require("@utils/math");
const chai_1 = __importStar(require("chai"));
const ethereum_waffle_1 = require("ethereum-waffle");
const hardhat_1 = require("hardhat");
chai_1.default.use(ethereum_waffle_1.solidity);
describe('Keep3rHelper', () => {
    let oraclePool;
    let keep3r;
    let keep3rV1;
    let helperFactory;
    let helper;
    let kp3rV1Address;
    let oraclePoolAddress;
    let targetBond;
    let randomKeeper;
    let rewardPeriodTime;
    let oneTenth;
    let mathUtils;
    before(async () => {
        [, randomKeeper] = await hardhat_1.ethers.getSigners();
        helperFactory = await smock_1.smock.mock('Keep3rHelperForTest');
        keep3r = await smock_1.smock.fake(IKeep3r_json_1.default);
        helper = await helperFactory.deploy(keep3r.address);
        oraclePoolAddress = await helper.callStatic.KP3R_WETH_POOL();
        oraclePool = await smock_1.smock.fake(IUniswapV3Pool_json_1.default, { address: oraclePoolAddress });
        kp3rV1Address = await helper.callStatic.KP3R();
        targetBond = await helper.callStatic.TARGETBOND();
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default, { address: kp3rV1Address });
        /* Twap calculation:
        // 1.0001**(-23027) = 0.100000022 ~= 0.1
        */
        mathUtils = math_1.mathUtilsFactory(0, 0);
        rewardPeriodTime = 100000;
        oneTenth = -23027 * rewardPeriodTime;
        oraclePool.token1.returns(kp3rV1Address);
        keep3r.observeLiquidity.whenCalledWith(oraclePoolAddress).returns([0, oneTenth, 0]);
        keep3r.rewardPeriodTime.returns(rewardPeriodTime);
    });
    beforeEach(async () => {
        keep3r.bonds.reset();
    });
    describe('quote', () => {
        it('should return keep3r KP3R/WETH quote', async () => {
            const toQuote = bn_1.toUnit(10);
            const quoteResult = bn_1.toUnit(1);
            /*
            // 1.0001**(-23027) ~= 0.1
            */
            chai_1.expect(await helper.callStatic.quote(toQuote)).to.be.closeTo(quoteResult, bn_1.toUnit(0.001).toNumber());
        });
        it('should work with 100 ETH', async () => {
            await chai_1.expect(helper.quote(bn_1.toUnit(100))).not.to.be.reverted;
        });
    });
    describe('bonds', () => {
        it('should return amount of KP3R bonds', async () => {
            const bondsResult = bn_1.toUnit(1);
            keep3r.bonds.whenCalledWith(randomKeeper.address, keep3rV1.address).returns(bondsResult);
            chai_1.expect(await helper.callStatic.bonds(randomKeeper.address)).to.equal(bondsResult);
        });
    });
    describe('getRewardAmountFor', () => {
        const baseFee = bn_1.toGwei(200);
        const gasUsed = bignumber_1.BigNumber.from(30000000);
        const expectedQuoteAmount = gasUsed.mul(baseFee).div(10);
        beforeEach(async () => {
            keep3r.observeLiquidity.whenCalledWith(oraclePoolAddress).returns([0, oneTenth, 0]);
            keep3r.rewardPeriodTime.returns(rewardPeriodTime);
            await helper.setVariable('basefee', baseFee);
        });
        it('should call bonds with the correct arguments', async () => {
            await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed);
            chai_1.expect(keep3r.bonds).to.be.calledOnceWith(randomKeeper.address, keep3rV1.address);
        });
        it('should return at least 110% of the quote', async () => {
            chai_1.expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.closeTo(expectedQuoteAmount.mul(11).div(10), bn_1.toUnit(0.0001).toNumber());
        });
        it('should boost the quote depending on the bonded KP3R of the keeper', async () => {
            keep3r.bonds.whenCalledWith(randomKeeper.address).returns(targetBond.sub(bn_1.toUnit(1)));
            // TODO: remove as any when this is solved: https://github.com/EthWorks/Waffle/issues/561
            chai_1.expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.be.within(expectedQuoteAmount.mul(11).div(10), expectedQuoteAmount.mul(12).div(10));
        });
        it('should return at most 120% of the quote', async () => {
            keep3r.bonds.whenCalledWith(randomKeeper.address, keep3rV1.address).returns(targetBond.mul(10));
            chai_1.expect(await helper.callStatic.getRewardAmountFor(randomKeeper.address, gasUsed)).to.closeTo(expectedQuoteAmount.mul(12).div(10), bn_1.toUnit(0.0001).toNumber());
        });
    });
    describe('getRewardAmount', () => {
        const baseFee = bn_1.toGwei(200);
        const gasUsed = bignumber_1.BigNumber.from(30000000);
        const expectedQuoteAmount = gasUsed.mul(baseFee).div(10);
        beforeEach(async () => {
            keep3r.observeLiquidity.whenCalledWith(oraclePoolAddress).returns([0, oneTenth, 0]);
            keep3r.rewardPeriodTime.returns(rewardPeriodTime);
            await helper.setVariable('basefee', baseFee);
        });
        it('should call bonds with the correct arguments', async () => {
            const proxyFactory = (await hardhat_1.ethers.getContractFactory('ProxyForTest'));
            const proxy = await proxyFactory.deploy();
            // call getRewardAmount through proxy
            await proxy.connect(randomKeeper).call(helper.address, helper.interface.encodeFunctionData('getRewardAmount', [gasUsed]));
            // should use tx.origin and not msg.sender
            chai_1.expect(keep3r.bonds).to.be.calledOnceWith(randomKeeper.address, keep3rV1.address);
        });
        it('should return at least 110% of the quote', async () => {
            chai_1.expect(await helper.callStatic.getRewardAmount(gasUsed)).to.closeTo(expectedQuoteAmount.mul(11).div(10), bn_1.toUnit(0.0001).toNumber());
        });
        it('should boost the quote depending on the bonded KP3R of the keeper', async () => {
            keep3r.bonds.returns(targetBond.sub(bn_1.toUnit(1)));
            // TODO: remove as any when this is solved: https://github.com/EthWorks/Waffle/issues/561
            chai_1.expect(await helper.callStatic.getRewardAmount(gasUsed)).to.be.within(expectedQuoteAmount.mul(11).div(10), expectedQuoteAmount.mul(12).div(10));
        });
        it('should return at most 120% of the quote', async () => {
            keep3r.bonds.returns(targetBond.mul(10));
            chai_1.expect(await helper.callStatic.getRewardAmount(gasUsed)).to.closeTo(expectedQuoteAmount.mul(12).div(10), bn_1.toUnit(0.0001).toNumber());
        });
    });
    describe('getRewardBoostFor', () => {
        const baseFee = bn_1.toGwei(200);
        beforeEach(async () => {
            await helper.setVariable('basefee', baseFee);
        });
        it('should return at least 110% boost on gasPrice', async () => {
            chai_1.expect(await helper.getRewardBoostFor(0)).to.be.eq(baseFee.mul(11000));
        });
        it('should boost gasPrice depending on the bonded KP3R of the keeper', async () => {
            chai_1.expect((await helper.getRewardBoostFor(targetBond.sub(bn_1.toUnit(1)))).div(baseFee)).to.be.within(11000, 12000);
        });
        it('should return at most a 120% boost on gasPrice', async () => {
            chai_1.expect(await helper.getRewardBoostFor(targetBond.mul(10))).to.be.be.eq(baseFee.mul(12000));
        });
    });
    describe('getPoolTokens', () => {
        it('should return the underlying tokens of the requested pool', async () => {
            const token0 = _utils_1.wallet.generateRandomAddress();
            const token1 = _utils_1.wallet.generateRandomAddress();
            oraclePool.token0.returns(token0);
            oraclePool.token1.returns(token1);
            chai_1.expect(await helper.getPoolTokens(oraclePool.address)).to.deep.eq([token0, token1]);
        });
    });
    describe('isKP3RToken0', () => {
        it('should revert if none of the underlying tokens is KP3R', async () => {
            oraclePool.token0.returns(_utils_1.wallet.generateRandomAddress());
            oraclePool.token1.returns(_utils_1.wallet.generateRandomAddress());
            await chai_1.expect(helper.isKP3RToken0(oraclePool.address)).to.be.revertedWith('LiquidityPairInvalid()');
        });
        it('should return true if KP3R is token0 of the pool', async () => {
            oraclePool.token0.returns(await helper.KP3R());
            oraclePool.token1.returns(_utils_1.wallet.generateRandomAddress());
            chai_1.expect(await helper.isKP3RToken0(oraclePool.address)).to.be.true;
        });
        it('should return false if KP3R is token0 of the pool', async () => {
            oraclePool.token0.returns(_utils_1.wallet.generateRandomAddress());
            oraclePool.token1.returns(await helper.KP3R());
            chai_1.expect(await helper.isKP3RToken0(oraclePool.address)).to.be.false;
        });
    });
    describe('observe', () => {
        const secondsAgo = [10];
        const tick1 = bignumber_1.BigNumber.from(1);
        beforeEach(() => {
            oraclePool.observe.reset();
            oraclePool.observe.returns([[tick1], []]);
        });
        it('should return false success when observe fails', async () => {
            oraclePool.observe.reverts();
            const result = await helper.callStatic.observe(oraclePool.address, secondsAgo);
            chai_1.expect(result).to.deep.equal([bignumber_1.BigNumber.from(0), bignumber_1.BigNumber.from(0), false]);
        });
        it('should call pool observe with given seconds ago', async () => {
            await helper.callStatic.observe(oraclePool.address, secondsAgo);
            chai_1.expect(oraclePool.observe).to.be.calledOnceWith(secondsAgo);
        });
        it('should return response first item', async () => {
            const result = await helper.callStatic.observe(oraclePool.address, secondsAgo);
            chai_1.expect(result).to.deep.equal([tick1, bignumber_1.BigNumber.from(0), true]);
        });
        it('should return response first and second item if given', async () => {
            const tick2 = bignumber_1.BigNumber.from(2);
            oraclePool.observe.returns([[tick1, tick2, 123], []]);
            const result = await helper.callStatic.observe(oraclePool.address, secondsAgo);
            chai_1.expect(result).to.deep.equal([tick1, tick2, true]);
        });
    });
    describe('getKP3RsAtTick', () => {
        const precision = 1000000;
        const liquidityAmount = bn_1.toUnit(1);
        const tickTimeDifference = 1;
        const tick2 = 0;
        it('should calculate the underlying tokens from a UniswapV3Pool liquidity', async () => {
            /* Calculation
            // liquidity = sqrt( x * y )
            // sqrtPrice = sqrt( y / x )
            // sqrtPrice = 1.0001 ^ tick/2 = 1.0001 ^ (t1-t2)/2*tickTimeDifference
            // x = liquidity / sqrtPrice
            */
            const tick1 = 23027;
            const sqrtPrice = 1.0001 ** (((tick1 - tick2) / 2) * tickTimeDifference);
            const expectedKP3Rs = liquidityAmount.mul(precision).div(Math.floor(sqrtPrice * precision));
            chai_1.expect(await helper.getKP3RsAtTick(liquidityAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(expectedKP3Rs, bn_1.toUnit(0.0001).toNumber());
        });
        it('should return a decreased amount if tick is increased', async () => {
            const tick1 = 1;
            chai_1.expect(await helper.getKP3RsAtTick(liquidityAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(mathUtils.decrease1Tick(liquidityAmount), bn_1.toUnit(0.0001).toNumber());
        });
        it('should return a increased amount if tick is decreased', async () => {
            const tick1 = -1;
            chai_1.expect(await helper.getKP3RsAtTick(liquidityAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(mathUtils.increase1Tick(liquidityAmount), bn_1.toUnit(0.0001).toNumber());
        });
    });
    describe('getQuoteAtTick', () => {
        const precision = 1000000;
        const baseAmount = bn_1.toUnit(3);
        const tickTimeDifference = 1;
        const tick1 = -23027;
        const tick2 = 0;
        it('should calculate a token conversion from a tick', async () => {
            /* Calculation
            // sqrtPrice = sqrt( y / x )
            // price = 1.0001 ^ tick = 1.0001 ^ (t2-t1)/tickTimeDifference
            // x = price * y
            */
            const price = 1.0001 ** ((tick1 - tick2) / tickTimeDifference);
            const expectedQuote = baseAmount.mul(precision).div(Math.floor(price * precision));
            chai_1.expect(await helper.getQuoteAtTick(baseAmount, tick1 - tick2, tickTimeDifference)).to.be.closeTo(expectedQuote, bn_1.toUnit(0.00001).toNumber());
        });
    });
});
