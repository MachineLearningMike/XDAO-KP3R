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
const ERC20_json_1 = __importDefault(require("@openzeppelin/contracts/build/contracts/ERC20.json"));
const IUniswapV3PoolForTest_json_1 = __importDefault(require("@solidity/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json"));
const IKeep3rV1_json_1 = __importDefault(require("@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json"));
const IKeep3rV1Proxy_json_1 = __importDefault(require("@solidity/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json"));
const IKeep3rHelper_json_1 = __importDefault(require("@solidity/interfaces/IKeep3rHelper.sol/IKeep3rHelper.json"));
const _utils_1 = require("@utils");
const bn_1 = require("@utils/bn");
const math_1 = require("@utils/math");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rJobDisputable', () => {
    const job = _utils_1.wallet.generateRandomAddress();
    let governance;
    let slasher;
    let disputer;
    let jobDisputable;
    let keep3rV1;
    let keep3rV1Proxy;
    let helper;
    let jobDisputableFactory;
    let liquidityA;
    let liquidityB;
    let oraclePool;
    // Parameter and function equivalent to contract's
    let rewardPeriodTime;
    let inflationPeriodTime;
    let mathUtils;
    before(async () => {
        [governance, slasher, disputer] = await hardhat_1.ethers.getSigners();
        jobDisputableFactory = await smock_1.smock.mock('Keep3rJobDisputableForTest');
    });
    beforeEach(async () => {
        helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        helper.isKP3RToken0.returns(true);
        jobDisputable = await jobDisputableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
        await jobDisputable.setVariable('slashers', { [slasher.address]: true });
        await jobDisputable.setVariable('disputers', { [disputer.address]: true });
        rewardPeriodTime = (await jobDisputable.rewardPeriodTime()).toNumber();
        inflationPeriodTime = (await jobDisputable.inflationPeriod()).toNumber();
        mathUtils = math_1.mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);
        await jobDisputable.setVariable('disputes', {
            [job]: true,
        });
        helper.observe.returns([0, 0, true]);
        helper.getKP3RsAtTick.returns(([amount]) => amount);
    });
    describe('slashTokenFromJob', () => {
        let tokenA;
        let tokenB;
        let tx;
        let initialTokenA = bn_1.toUnit(1);
        let initialTokenB = bn_1.toUnit(2);
        let tokenAToRemove = bn_1.toUnit(0.9);
        beforeEach(async () => {
            // setup tokens
            tokenA = await smock_1.smock.fake(ERC20_json_1.default);
            tokenB = await smock_1.smock.fake(ERC20_json_1.default);
            tokenA.transfer.returns(true);
            tokenB.transfer.returns(true);
            await jobDisputable.setJobToken(job, tokenA.address);
            await jobDisputable.setJobToken(job, tokenB.address);
            await jobDisputable.setVariable('jobTokenCredits', {
                [job]: {
                    [tokenA.address]: initialTokenA,
                    [tokenB.address]: initialTokenB,
                },
            });
        });
        it('should fail to slash unexistent token', async () => {
            await chai_1.expect(jobDisputable.connect(slasher).slashTokenFromJob(job, _utils_1.wallet.generateRandomAddress(), 1)).to.be.revertedWith('JobTokenUnexistent()');
        });
        it('should fail to slash more than balance', async () => {
            await chai_1.expect(jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA.add(1))).to.be.revertedWith('JobTokenInsufficient()');
        });
        it('should revert if job is not disputed', async () => {
            await jobDisputable.setVariable('disputes', {
                [job]: false,
            });
            await chai_1.expect(jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA)).to.be.revertedWith('NotDisputed()');
        });
        it('should remove token from list if there is no remaining', async () => {
            await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA);
            chai_1.expect(await jobDisputable.internalJobTokens(job)).to.deep.equal([tokenB.address]);
        });
        context('when partially slashing a token', () => {
            beforeEach(async () => {
                tokenA.transfer.returns(true);
                tx = await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, tokenAToRemove);
            });
            it('should transfer the tokens to governance', async () => {
                chai_1.expect(tokenA.transfer).to.be.calledOnceWith(governance.address, tokenAToRemove);
            });
            it('should reduce the specified amount from token credits', async () => {
                chai_1.expect(await jobDisputable.jobTokenCredits(job, tokenA.address)).to.equal(initialTokenA.sub(tokenAToRemove));
            });
            it('should not remove liquidity from list if there is some remaining', async () => {
                chai_1.expect(await jobDisputable.internalJobTokens(job)).to.deep.equal([tokenA.address, tokenB.address]);
            });
            it('should not affect other liquidity balance', async () => {
                chai_1.expect(await jobDisputable.jobTokenCredits(job, tokenB.address)).to.equal(initialTokenB);
            });
            it('should emit event', async () => {
                await chai_1.expect(tx).to.emit(jobDisputable, 'JobSlashToken').withArgs(job, tokenA.address, slasher.address, tokenAToRemove);
            });
        });
        context('when some transfer fails', () => {
            beforeEach(async () => {
                tokenA.transfer.reverts();
            });
            it('should not revert', async () => {
                await chai_1.expect(jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA)).not.to.be.reverted;
            });
            it('should call the transfer function', async () => {
                await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA);
                chai_1.expect(tokenA.transfer).to.be.calledOnceWith(governance.address, initialTokenA);
            });
            it('should slash the token', async () => {
                await jobDisputable.connect(slasher).slashTokenFromJob(job, tokenA.address, initialTokenA);
                chai_1.expect(await jobDisputable.jobTokenCredits(job, tokenA.address)).to.equal(initialTokenA.sub(initialTokenA));
            });
        });
    });
    describe('slashLiquidityFromJob', () => {
        let tx;
        let initialLiquidityA;
        let initialLiquidityB;
        let initialLiquidityCredits = bn_1.toUnit(1);
        let liquidityAToRemove = bn_1.toUnit(0.3);
        beforeEach(async () => {
            initialLiquidityA = mathUtils.calcLiquidityToAdd(bn_1.toUnit(1));
            initialLiquidityB = mathUtils.calcLiquidityToAdd(bn_1.toUnit(2));
            // setup liquidity
            liquidityA = await smock_1.smock.fake('UniV3PairManager');
            liquidityB = await smock_1.smock.fake('UniV3PairManager');
            await jobDisputable.setApprovedLiquidity(liquidityA.address);
            await jobDisputable.setApprovedLiquidity(liquidityB.address);
            await jobDisputable.setJobLiquidity(job, liquidityA.address);
            await jobDisputable.setJobLiquidity(job, liquidityB.address);
            await jobDisputable.setVariable('liquidityAmount', {
                [job]: {
                    [liquidityA.address]: initialLiquidityA,
                    [liquidityB.address]: initialLiquidityB,
                },
            });
            // setup credits
            await jobDisputable.setVariable('_jobLiquidityCredits', { [job]: initialLiquidityCredits });
            await jobDisputable.setVariable('_jobPeriodCredits', { [job]: initialLiquidityA.add(initialLiquidityB) });
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobDisputable.setVariable('rewardedAt', { [job]: blockTimestamp });
            await jobDisputable.setVariable('_tick', { [liquidityA.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
            await jobDisputable.setVariable('_tick', { [liquidityB.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
        });
        it('should fail to slash unexistent liquidity', async () => {
            await chai_1.expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, _utils_1.wallet.generateRandomAddress(), 1)).to.be.revertedWith('JobLiquidityUnexistent()');
        });
        it('should fail to slash more than balance', async () => {
            await chai_1.expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, initialLiquidityA.add(1))).to.be.revertedWith('JobLiquidityInsufficient()');
        });
        it('should revert if job is not disputed', async () => {
            await jobDisputable.setVariable('disputes', {
                [job]: false,
            });
            await chai_1.expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove)).to.be.revertedWith('NotDisputed()');
        });
        it('should remove liquidity from list if there is no remaining', async () => {
            liquidityA.transfer.returns(true);
            await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, initialLiquidityA);
            chai_1.expect(await jobDisputable.internalJobLiquidities(job)).to.deep.equal([liquidityB.address]);
        });
        context('when liquidity is revoked', () => {
            beforeEach(async () => {
                liquidityA.transfer.returns(true);
                await jobDisputable.setRevokedLiquidity(liquidityA.address);
            });
            it('should transfer the tokens to governance', async () => {
                await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
                chai_1.expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
            });
            it('should emit an event', async () => {
                await chai_1.expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove))
                    .to.emit(jobDisputable, 'JobSlashLiquidity')
                    .withArgs(job, liquidityA.address, slasher.address, liquidityAToRemove);
            });
        });
        context('when partially slashing a liquidity', () => {
            beforeEach(async () => {
                liquidityA.transfer.returns(true);
                tx = await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
            });
            it('should transfer the tokens to governance', async () => {
                chai_1.expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
            });
            it('should reduce the specified amount from liquidity accountance', async () => {
                chai_1.expect(await jobDisputable.liquidityAmount(job, liquidityA.address)).to.equal(initialLiquidityA.sub(liquidityAToRemove));
            });
            it('should not remove liquidity from list if there is some remaining', async () => {
                chai_1.expect(await jobDisputable.internalJobLiquidities(job)).to.deep.equal([liquidityA.address, liquidityB.address]);
            });
            it('should not affect other liquidity balance', async () => {
                chai_1.expect(await jobDisputable.liquidityAmount(job, liquidityB.address)).to.equal(initialLiquidityB);
            });
            it('should reduce liquidity credits proportionally', async () => {
                const totalLiquidity = initialLiquidityA.add(initialLiquidityB);
                const expected = initialLiquidityCredits.mul(totalLiquidity.sub(liquidityAToRemove)).div(totalLiquidity);
                chai_1.expect(await jobDisputable.jobLiquidityCredits(job)).to.equal(expected);
            });
            it('should recalculate period credits', async () => {
                let quotedCredits;
                quotedCredits = mathUtils.calcPeriodCredits(initialLiquidityA.sub(liquidityAToRemove));
                quotedCredits = quotedCredits.add(mathUtils.calcPeriodCredits(initialLiquidityB));
                chai_1.expect(await jobDisputable.jobPeriodCredits(job)).to.equal(quotedCredits);
            });
            it('should emit event', async () => {
                await chai_1.expect(tx).to.emit(jobDisputable, 'JobSlashLiquidity').withArgs(job, liquidityA.address, slasher.address, liquidityAToRemove);
            });
        });
        context('when some transfer fails', () => {
            beforeEach(async () => {
                liquidityA.transfer.reverts();
            });
            it('should not revert', async () => {
                await chai_1.expect(jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove)).not.to.be.reverted;
            });
            it('should call the transfer function', async () => {
                await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
                chai_1.expect(liquidityA.transfer).to.be.calledOnceWith(governance.address, liquidityAToRemove);
            });
            it('should slash the liquidity', async () => {
                await jobDisputable.connect(slasher).slashLiquidityFromJob(job, liquidityA.address, liquidityAToRemove);
                chai_1.expect(await jobDisputable.liquidityAmount(job, liquidityA.address)).to.equal(initialLiquidityA.sub(liquidityAToRemove));
            });
        });
    });
});
