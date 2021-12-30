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
const constants_1 = require("@utils/constants");
const math_1 = require("@utils/math");
const chai_1 = __importStar(require("chai"));
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const moment_1 = __importDefault(require("moment"));
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rJobFundableLiquidity', () => {
    const randomJob = _utils_1.wallet.generateRandomAddress();
    let governance;
    let provider;
    let jobOwner;
    let jobFundable;
    let keep3rV1;
    let keep3rV1Proxy;
    let helper;
    let randomLiquidity;
    let approvedLiquidity;
    let jobFundableFactory;
    let oraclePool;
    // Parameter and function equivalent to contract's
    let rewardPeriodTime;
    let inflationPeriodTime;
    let mathUtils;
    let oneTick;
    before(async () => {
        [governance, jobOwner, provider] = await hardhat_1.ethers.getSigners();
        jobFundableFactory = await smock_1.smock.mock('Keep3rJobFundableLiquidityForTest');
    });
    beforeEach(async () => {
        helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        randomLiquidity = await smock_1.smock.fake('UniV3PairManager');
        approvedLiquidity = await smock_1.smock.fake('UniV3PairManager');
        oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        helper.isKP3RToken0.returns(true);
        approvedLiquidity.transfer.returns(true);
        approvedLiquidity.transferFrom.returns(true);
        jobFundable = await jobFundableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
        await jobFundable.setVariable('jobOwner', {
            [randomJob]: jobOwner.address,
        });
        rewardPeriodTime = (await jobFundable.rewardPeriodTime()).toNumber();
        inflationPeriodTime = (await jobFundable.inflationPeriod()).toNumber();
        mathUtils = math_1.mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);
        const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
        const testPeriodTime = mathUtils.calcPeriod(blockTimestamp + rewardPeriodTime) + rewardPeriodTime / 2;
        // set the test to start mid-period
        _utils_1.evm.advanceToTime(testPeriodTime);
        _utils_1.evm.advanceBlock();
        oneTick = rewardPeriodTime;
        helper.observe.returns([0, 0, true]);
        helper.getKP3RsAtTick.returns(([amount]) => amount);
        // set oraclePool to be updated
        await jobFundable.setVariable('_tick', { [oraclePool.address]: { period: mathUtils.calcPeriod(testPeriodTime) } });
        // set and initialize approvedLiquidity
        await jobFundable.setApprovedLiquidity(approvedLiquidity.address);
        await jobFundable.setVariable('_liquidityPool', { [approvedLiquidity.address]: oraclePool.address });
        await jobFundable.setVariable('_isKP3RToken0', { [approvedLiquidity.address]: true });
    });
    describe('jobPeriodCredits', () => {
        const liquidityAmount = bn_1.toUnit(1);
        beforeEach(async () => {
            await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
            await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAmount } });
        });
        context('when liquidity is updated', () => {
            beforeEach(async () => {
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
            });
            it('should not call the oracle', async () => {
                await jobFundable.jobPeriodCredits(randomJob);
                chai_1.expect(helper.observe).not.to.have.been.called;
            });
            it('should return a full period of credits', async () => {
                const expectedCredits = mathUtils.calcPeriodCredits(bn_1.toUnit(1));
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
            });
        });
        context('when liquidity is outdated', () => {
            beforeEach(async () => {
                helper.observe.reset();
                helper.observe.returns([0, 0, true]);
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobFundable.setVariable('_tick', {
                    [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
                });
            });
            it('should call the oracle', async () => {
                await jobFundable.jobPeriodCredits(randomJob);
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                chai_1.expect(helper.observe).to.have.been.calledOnceWith(oraclePool.address, [blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
            });
            it('should return a full period of credits', async () => {
                const expectedCredits = mathUtils.calcPeriodCredits(bn_1.toUnit(1));
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
            });
        });
        context('when liquidity is expired', () => {
            beforeEach(async () => {
                helper.observe.reset();
                helper.observe.returns([0, 0, true]);
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobFundable.setVariable('_tick', {
                    [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - 2 * rewardPeriodTime) },
                });
            });
            it('should call the oracle', async () => {
                await jobFundable.jobPeriodCredits(randomJob);
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                chai_1.expect(helper.observe).to.have.been.calledOnceWith(oraclePool.address, [
                    blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
                    blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
                ]);
            });
            it('should return a full period of credits', async () => {
                const expectedCredits = mathUtils.calcPeriodCredits(bn_1.toUnit(1));
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits);
            });
        });
        context('when liquidity twap has changed', () => {
            let oldCreditsForComparison;
            beforeEach(async () => {
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                const liquidityParams = {
                    current: 0,
                    difference: 0,
                    period: mathUtils.calcPeriod(blockTimestamp),
                };
                await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: liquidityParams });
                oldCreditsForComparison = mathUtils.calcPeriodCredits(bn_1.toUnit(1));
                await jobFundable.setVariable('_tick', {
                    [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
                });
            });
            // If KP3R price went up, previous credits are worth less KP3Rs
            it('should return an decreased amount if increased', async () => {
                helper.observe.returns([rewardPeriodTime, 0, true]);
                await jobFundable.setVariable('_isKP3RToken0', { [approvedLiquidity.address]: true });
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(mathUtils.decrease1Tick(oldCreditsForComparison), mathUtils.blockShiftPrecision);
            });
            it('should return an increased amount if decreased', async () => {
                helper.observe.returns([-rewardPeriodTime, 0, true]);
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(mathUtils.increase1Tick(oldCreditsForComparison), mathUtils.blockShiftPrecision);
            });
        });
        context('when there are more than 1 liquidities', () => {
            const liquidityAmount = bn_1.toUnit(1);
            beforeEach(async () => {
                randomLiquidity.token0.returns(keep3rV1.address);
                await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
                await jobFundable.setJobLiquidity(randomJob, randomLiquidity.address);
                await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [randomLiquidity.address]: liquidityAmount } });
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
                await jobFundable.setVariable('_tick', { [randomLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
            });
            it('should return a full period for each liquidity', async () => {
                const expectedCredits1 = mathUtils.calcPeriodCredits(liquidityAmount);
                const expectedCredits2 = mathUtils.calcPeriodCredits(liquidityAmount);
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(expectedCredits1.add(expectedCredits2));
            });
        });
    });
    describe('jobLiquidityCredits', () => {
        let blockTimestamp;
        beforeEach(async () => {
            await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
            await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: bn_1.toUnit(1) } });
            await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: bn_1.toUnit(1) });
            await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: bn_1.toUnit(1) });
            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            let tickSetting = {
                current: rewardPeriodTime,
                difference: rewardPeriodTime,
                period: mathUtils.calcPeriod(blockTimestamp),
            };
            await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
            helper.observe.returns([rewardPeriodTime, 0, true]);
        });
        context('when job accountance is updated', () => {
            beforeEach(async () => {
                await jobFundable.setVariable('workedAt', { [randomJob]: blockTimestamp });
                await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
            });
            it('should return current job credits', async () => {
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(mathUtils.calcPeriodCredits(bn_1.toUnit(1)), mathUtils.blockShiftPrecision);
            });
        });
        context('when job accountance is outdated', () => {
            beforeEach(async () => {
                await jobFundable.setVariable('workedAt', { [randomJob]: blockTimestamp - rewardPeriodTime });
                let tickSetting = {
                    current: rewardPeriodTime,
                    difference: rewardPeriodTime,
                    period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
                };
                await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
                helper.observe.returns([2 * rewardPeriodTime, rewardPeriodTime, true]);
            });
            it('should return old job credits updated to current price', async () => {
                const previousPeriodCredits = mathUtils.calcPeriodCredits(bn_1.toUnit(1));
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(mathUtils.increase1Tick(previousPeriodCredits), mathUtils.blockShiftPrecision);
            });
        });
        context('when job accountance is expired', () => {
            beforeEach(async () => {
                await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp - 2 * rewardPeriodTime });
            });
            it('should return a full period of credits', async () => {
                const expectedCredits = mathUtils.calcPeriodCredits(bn_1.toUnit(1));
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(expectedCredits, mathUtils.blockShiftPrecision);
            });
        });
    });
    describe('totalJobCredits', () => {
        let blockTimestamp;
        const liquidityAdded = bn_1.toUnit(1);
        let jobPeriodCredits;
        it('should return 0 with an empty job', async () => {
            chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(0);
        });
        context('when job has only forced credits', () => {
            beforeEach(async () => {
                await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: bn_1.toUnit(1) });
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            });
            it('should return forced credits if are updated', async () => {
                await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp });
                chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(bn_1.toUnit(1));
            });
            it('should return 0 if forced credits are outdated', async () => {
                await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp - rewardPeriodTime });
                chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(0);
            });
        });
        context('when job has added liquidity', () => {
            beforeEach(async () => {
                jobPeriodCredits = mathUtils.calcPeriodCredits(liquidityAdded);
                await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
                await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: jobPeriodCredits });
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            });
            context('when job was rewarded this period', () => {
                beforeEach(async () => {
                    await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
                    await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp) });
                    // if job accountance is updated, then it's liquidity must updated be as well
                    await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
                });
                it('should not call the oracle', async () => {
                    await jobFundable.totalJobCredits(randomJob);
                    chai_1.expect(helper.observe).not.to.have.been.called;
                });
                it('should return current credits + minted since period start', async () => {
                    const jobLiquidityCredits = await jobFundable.jobLiquidityCredits(randomJob);
                    chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(jobLiquidityCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp))));
                });
                context('when job was rewarded after period started', () => {
                    let rewardTimestamp;
                    beforeEach(async () => {
                        rewardTimestamp = Math.floor((mathUtils.calcPeriod(blockTimestamp) + blockTimestamp) / 2);
                        await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
                    });
                    it('should return current credits + minted since reward reference', async () => {
                        const jobLiquidityCredits = await jobFundable.jobLiquidityCredits(randomJob);
                        chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(jobLiquidityCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - rewardTimestamp)));
                    });
                });
            });
            context('when job was rewarded last period', () => {
                let oldLiquidityCredits;
                beforeEach(async () => {
                    oldLiquidityCredits = mathUtils.calcPeriodCredits(bn_1.toUnit(1));
                    await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: oldLiquidityCredits });
                    await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
                    await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) });
                });
                it('should call the oracle', async () => {
                    await jobFundable.totalJobCredits(randomJob);
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    chai_1.expect(helper.observe).to.have.been.calledWith(oraclePool.address, [
                        blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
                        blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
                    ]);
                });
                it('should return updated credits + minted since period start', async () => {
                    const totalJobCredits = await jobFundable.totalJobCredits(randomJob);
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    chai_1.expect(totalJobCredits).to.be.closeTo(mathUtils
                        .decrease1Tick(oldLiquidityCredits)
                        .add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp))), mathUtils.blockShiftPrecision);
                });
                context('when job was rewarded after period started', () => {
                    let rewardTimestamp;
                    beforeEach(async () => {
                        blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                        rewardTimestamp = Math.floor(mathUtils.calcPeriod(blockTimestamp) - rewardPeriodTime / 10);
                        await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
                        let tickSetting = {
                            current: oneTick,
                            difference: oneTick,
                            period: mathUtils.calcPeriod(blockTimestamp),
                        };
                        await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
                    });
                    it('should return updated credits + minted since reward reference', async () => {
                        const totalJobCredits = await jobFundable.totalJobCredits(randomJob);
                        chai_1.expect(totalJobCredits).to.be.closeTo(mathUtils
                            .decrease1Tick(oldLiquidityCredits)
                            .add(mathUtils.calcMintedCredits(mathUtils.decrease1Tick(oldLiquidityCredits), blockTimestamp - rewardTimestamp)), mathUtils.blockShiftPrecision);
                    });
                });
            });
            context('when job was rewarded exactly 1 period ago', () => {
                beforeEach(async () => {
                    await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
                    await jobFundable.setVariable('rewardedAt', { [randomJob]: blockTimestamp - rewardPeriodTime });
                    await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
                });
                it('should return a full period of credits', async () => {
                    const expectedCredits = mathUtils.calcPeriodCredits(liquidityAdded);
                    chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq(expectedCredits);
                });
            });
            context('when job was rewarded more than 1 period ago', () => {
                let rewardTimestamp;
                beforeEach(async () => {
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    rewardTimestamp = blockTimestamp - 1.1 * rewardPeriodTime;
                    await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: liquidityAdded } });
                    await jobFundable.setVariable('rewardedAt', { [randomJob]: rewardTimestamp });
                    await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
                });
                it('should return a full period of credits + minted sice reward reference', async () => {
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.closeTo(jobPeriodCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - (rewardTimestamp + rewardPeriodTime))), mathUtils.blockShiftPrecision);
                });
            });
            context('when job was rewarded more than 2 periods ago', () => {
                beforeEach(async () => {
                    await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: bn_1.toUnit(1) } });
                    await jobFundable.setVariable('workedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp - 2 * rewardPeriodTime) });
                    await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: blockTimestamp - 2 * rewardPeriodTime } });
                });
                it('should return a full period of credits + minted since period start', async () => {
                    chai_1.expect(await jobFundable.totalJobCredits(randomJob)).to.be.eq((await jobFundable.jobPeriodCredits(randomJob)).add((await jobFundable.jobPeriodCredits(randomJob)).mul(blockTimestamp - mathUtils.calcPeriod(blockTimestamp)).div(rewardPeriodTime)));
                });
            });
        });
    });
    describe('quoteLiquidity', () => {
        it('should return 0 if liquidity is not approved', async () => {
            chai_1.expect(await jobFundable.quoteLiquidity(randomLiquidity.address, bn_1.toUnit(1))).to.be.eq(0);
        });
        it('should not call the oracle when liquidity is updated', async () => {
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
            await jobFundable.quoteLiquidity(approvedLiquidity.address, bn_1.toUnit(1));
            chai_1.expect(helper.observe).not.to.have.been.called;
        });
        it('should call the oracle when liquidity is outdated', async () => {
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobFundable.setVariable('_tick', {
                [approvedLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) },
            });
            await jobFundable.quoteLiquidity(approvedLiquidity.address, bn_1.toUnit(1));
            chai_1.expect(helper.observe).have.been.calledWith(oraclePool.address, [blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
        });
        it('should call the oracle when liquidity is expired', async () => {
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobFundable.quoteLiquidity(approvedLiquidity.address, bn_1.toUnit(1));
            chai_1.expect(helper.observe).have.been.calledWith(oraclePool.address, [
                blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
                blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
            ]);
        });
        it('should quote the liquidity with reward calculation', async () => {
            /*
            // REWARD CALCULATION
            // twapCalculation: amountIn * 1.0001**(-difference/timeElapsed)
            // difference: rewardPeriodTime
            // timeElapsed: rewardPeriodTime
            // twapCalculation: amountIn / 1.0001
            //
            // rewardCalculation: twapCalculation * rewardPeriod / inflationPeriod
            */
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            const liquidityParams = {
                period: mathUtils.calcPeriod(blockTimestamp),
                difference: rewardPeriodTime,
            };
            const amountIn = bn_1.toUnit(1);
            await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: liquidityParams });
            chai_1.expect(await jobFundable.quoteLiquidity(approvedLiquidity.address, amountIn)).to.be.closeTo(mathUtils.calcPeriodCredits(mathUtils.decrease1Tick(amountIn)), mathUtils.blockShiftPrecision);
        });
    });
    describe('observeLiquidity', () => {
        let blockTimestamp;
        beforeEach(async () => {
            helper.observe.reset();
            const liquidityParams = {
                current: 0,
                difference: 0,
            };
            await jobFundable.setVariable('_tick', { [randomLiquidity.address]: liquidityParams });
            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
        });
        context('when liquidity is updated', () => {
            let period;
            beforeEach(async () => {
                period = mathUtils.calcPeriod(blockTimestamp);
                await jobFundable.setVariable('_tick', { [randomLiquidity.address]: { period: period } });
            });
            it('should return current tick', async () => {
                chai_1.expect(await jobFundable.observeLiquidity(randomLiquidity.address)).to.deep.equal([
                    ethers_1.BigNumber.from(0),
                    ethers_1.BigNumber.from(0),
                    ethers_1.BigNumber.from(period),
                ]);
            });
            it('should not call the oracle', async () => {
                await jobFundable.observeLiquidity(randomLiquidity.address);
                chai_1.expect(helper.observe).not.to.be.called;
            });
        });
        context('when liquidity is outdated', () => {
            let period;
            beforeEach(async () => {
                period = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime);
                await jobFundable.setVariable('_tick', { [randomLiquidity.address]: { period: period } });
                await jobFundable.setVariable('_liquidityPool', { [randomLiquidity.address]: oraclePool.address });
                helper.observe.returns([1, 0, true]);
            });
            it('should return oracle tick and calculate difference', async () => {
                chai_1.expect(await jobFundable.observeLiquidity(randomLiquidity.address)).to.deep.equal([
                    ethers_1.BigNumber.from(1),
                    ethers_1.BigNumber.from(1),
                    ethers_1.BigNumber.from(mathUtils.calcPeriod(blockTimestamp)),
                ]);
            });
            it('should call the oracle', async () => {
                await jobFundable.observeLiquidity(randomLiquidity.address);
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                chai_1.expect(helper.observe).to.have.be.calledWith(oraclePool.address, [blockTimestamp - mathUtils.calcPeriod(blockTimestamp)]);
            });
        });
        context('when liquidity is expired', () => {
            beforeEach(async () => {
                helper.observe.returns([2, 1, true]);
            });
            it('should return oracle tick and difference', async () => {
                chai_1.expect(await jobFundable.observeLiquidity(approvedLiquidity.address)).to.deep.equal([
                    ethers_1.BigNumber.from(2),
                    ethers_1.BigNumber.from(1),
                    ethers_1.BigNumber.from(mathUtils.calcPeriod(blockTimestamp)),
                ]);
            });
            it('should call the oracle', async () => {
                await jobFundable.observeLiquidity(approvedLiquidity.address);
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                chai_1.expect(helper.observe).to.have.be.calledWith(oraclePool.address, [
                    blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
                    blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
                ]);
            });
        });
    });
    describe('forceLiquidityCreditsToJob', () => {
        _utils_1.behaviours.onlyGovernance(() => jobFundable, 'forceLiquidityCreditsToJob', governance, [randomJob, 1]);
        it('should revert when called with unallowed job', async () => {
            await chai_1.expect(jobFundable.forceLiquidityCreditsToJob(randomJob, bn_1.toUnit(1))).to.be.revertedWith('JobUnavailable()');
        });
        context('when job was approved', () => {
            beforeEach(async () => {
                await jobFundable.setJob(randomJob);
            });
            it('should reward job previously minted credits', async () => {
                const block = await hardhat_1.ethers.provider.getBlock('latest');
                await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: bn_1.toUnit(1) });
                await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(block.timestamp) });
                // The job has 0 credits but should be rewarded some
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(0);
                await jobFundable.forceLiquidityCreditsToJob(randomJob, 0);
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.gt(0);
            });
            it('should update last reward timestamp', async () => {
                await jobFundable.forceLiquidityCreditsToJob(randomJob, bn_1.toUnit(1));
                const block = await hardhat_1.ethers.provider.getBlock('latest');
                chai_1.expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(block.timestamp);
            });
            it('should increase job liquidity credits', async () => {
                await jobFundable.forceLiquidityCreditsToJob(randomJob, bn_1.toUnit(1));
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.equal(bn_1.toUnit(1));
            });
            it('should add liquidity credits that dont change value', async () => {
                await jobFundable.forceLiquidityCreditsToJob(randomJob, bn_1.toUnit(1));
                helper.observe.returns([rewardPeriodTime, 0, true]);
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobFundable.setVariable('_tick', {
                    [approvedLiquidity.address]: {
                        current: 0,
                        difference: 0,
                        period: mathUtils.calcPeriod(blockTimestamp),
                    },
                });
                await _utils_1.evm.advanceTimeAndBlock(rewardPeriodTime - 10);
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.equal(bn_1.toUnit(1));
            });
            it('should add liquidity credits that expire', async () => {
                await jobFundable.forceLiquidityCreditsToJob(randomJob, bn_1.toUnit(1));
                await _utils_1.evm.advanceTimeAndBlock(rewardPeriodTime);
                chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.equal(0);
            });
            it('should emit event', async () => {
                const forcedLiquidityAmount = bn_1.toUnit(1);
                const tx = await jobFundable.connect(governance).forceLiquidityCreditsToJob(randomJob, forcedLiquidityAmount);
                const rewardedAt = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await chai_1.expect(tx).to.emit(jobFundable, 'LiquidityCreditsForced').withArgs(randomJob, rewardedAt, forcedLiquidityAmount);
            });
        });
    });
    describe('approveLiquidity', () => {
        _utils_1.behaviours.onlyGovernance(() => jobFundable, 'approveLiquidity', governance, () => [approvedLiquidity.address]);
        it('should revert when liquidity already approved', async () => {
            await chai_1.expect(jobFundable.connect(governance).approveLiquidity(approvedLiquidity.address)).to.be.revertedWith('LiquidityPairApproved()');
        });
        it('should add the liquidity to approved liquidities list', async () => {
            await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
            chai_1.expect(await jobFundable.approvedLiquidities()).to.contain(randomLiquidity.address);
        });
        it('should sort the tokens in the liquidity pair', async () => {
            await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
            chai_1.expect(await jobFundable.viewTickOrder(randomLiquidity.address)).to.be.true;
        });
        it('should initialize twap for liquidity', async () => {
            await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
            chai_1.expect(helper.observe).to.have.been.called;
        });
        it('should emit event', async () => {
            await chai_1.expect(jobFundable.connect(governance).approveLiquidity(randomLiquidity.address))
                .to.emit(jobFundable, 'LiquidityApproval')
                .withArgs(randomLiquidity.address);
        });
    });
    describe('revokeLiquidity', () => {
        _utils_1.behaviours.onlyGovernance(() => jobFundable, 'revokeLiquidity', governance, () => [approvedLiquidity.address]);
        it('should not be able to remove unapproved liquidity', async () => {
            await chai_1.expect(jobFundable.connect(governance).revokeLiquidity(randomLiquidity.address)).to.be.revertedWith('LiquidityPairUnexistent()');
        });
        it('should not be able to remove the same liquidity twice', async () => {
            await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
            await chai_1.expect(jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address)).to.be.revertedWith('LiquidityPairUnexistent()');
        });
        it('should remove liquidity', async () => {
            await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
            chai_1.expect(await jobFundable.approvedLiquidities()).not.to.contain(approvedLiquidity.address);
        });
        it('should not remove other liquidities', async () => {
            await jobFundable.connect(governance).approveLiquidity(randomLiquidity.address);
            await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
            chai_1.expect(await jobFundable.approvedLiquidities()).to.contain(randomLiquidity.address);
        });
        it('should avoid a revoked liquidity from minting new credits', async () => {
            await jobFundable.setJob(randomJob);
            await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, bn_1.toUnit(10));
            chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.gt(0);
            await jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address);
            chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(bn_1.toUnit(0));
        });
        it('should emit event', async () => {
            await chai_1.expect(jobFundable.connect(governance).revokeLiquidity(approvedLiquidity.address))
                .to.emit(jobFundable, 'LiquidityRevocation')
                .withArgs(approvedLiquidity.address);
        });
    });
    describe('addLiquidityToJob', () => {
        it('should revert when liquidity pair is not accepted', async () => {
            await chai_1.expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, randomLiquidity.address, bn_1.toUnit(1))).to.be.revertedWith('LiquidityPairUnapproved()');
        });
        it('should revert when job is not accepted', async () => {
            await chai_1.expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, bn_1.toUnit(1))).to.be.revertedWith('JobUnavailable()');
        });
        context('when liquidity pair and job are accepted', async () => {
            beforeEach(async () => {
                await jobFundable.setJob(randomJob);
            });
            it('should revert when transfer reverts', async () => {
                approvedLiquidity.transferFrom.returns(false);
                const liquidityToAdd = mathUtils.calcLiquidityToAdd(bn_1.toUnit(1));
                await chai_1.expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd)).to.be.revertedWith('ERC20 operation did not succeed');
            });
            it('should revert if the amount is less than the minimum', async () => {
                await chai_1.expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, bn_1.toUnit(0.49))).to.be.revertedWith('JobLiquidityLessThanMin()');
            });
            it('should not revert when adding a tiny amount of liquidity if the minimum is already satisfied', async () => {
                const liquidityToAdd = mathUtils.calcLiquidityToAdd(bn_1.toUnit(1));
                await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
                await chai_1.expect(jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, bn_1.toUnit(0.01))).not.to.be.revertedWith('JobLiquidityLessThanMin()');
            });
            it('should transfer the liquidity tokens to contract', async () => {
                const liquidityToAdd = mathUtils.calcLiquidityToAdd(bn_1.toUnit(1));
                await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
                chai_1.expect(approvedLiquidity.transferFrom).to.be.calledOnceWith(provider.address, jobFundable.address, liquidityToAdd);
            });
            it('should add liquidity amount to balance', async () => {
                const liquidityToAdd = mathUtils.calcLiquidityToAdd(bn_1.toUnit(1));
                await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
                chai_1.expect(await jobFundable.liquidityAmount(randomJob, approvedLiquidity.address)).to.equal(liquidityToAdd);
            });
            it('should update last reward timestamp', async () => {
                const liquidityToAdd = mathUtils.calcLiquidityToAdd(bn_1.toUnit(1));
                await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                chai_1.expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(blockTimestamp);
            });
            it('should update job period credits for job', async () => {
                const jobLiquidityAmount = bn_1.toUnit(10);
                const calculatedJobPeriodCredits = mathUtils.calcPeriodCredits(jobLiquidityAmount);
                await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: 0 });
                await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: jobLiquidityAmount } });
                await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, 0);
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.eq(calculatedJobPeriodCredits);
            });
            it('should emit event', async () => {
                const liquidityToAdd = mathUtils.calcLiquidityToAdd(bn_1.toUnit(1));
                const tx = await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, liquidityToAdd);
                await chai_1.expect(tx)
                    .to.emit(jobFundable, 'LiquidityAddition')
                    .withArgs(randomJob, approvedLiquidity.address, provider.address, liquidityToAdd);
            });
            context('when there was previous liquidity', () => {
                beforeEach(async () => {
                    const previousJobLiquidityAmount = bn_1.toUnit(10);
                    await jobFundable.setJobLiquidity(randomJob, randomLiquidity.address);
                    await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: previousJobLiquidityAmount } });
                    await jobFundable.setVariable('_jobPeriodCredits', {
                        [randomJob]: mathUtils.calcPeriodCredits(previousJobLiquidityAmount),
                    });
                });
                it('should settle current credits debt of previous liquidity', async () => {
                    await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(1, 'days').as('seconds'));
                    await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, bn_1.toUnit(1));
                    let totalCredits = await jobFundable.totalJobCredits(randomJob);
                    chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(totalCredits);
                });
            });
            context('when liquidity twaps are outdated', () => {
                let previousJobLiquidityAmount;
                beforeEach(async () => {
                    const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    previousJobLiquidityAmount = bn_1.toUnit(10);
                    await jobFundable.setJobLiquidity(randomJob, randomLiquidity.address);
                    await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: previousJobLiquidityAmount } });
                    await jobFundable.setVariable('rewardedAt', { [randomJob]: 0 });
                    await jobFundable.setVariable('_jobPeriodCredits', {
                        [randomJob]: mathUtils.calcPeriodCredits(previousJobLiquidityAmount),
                    });
                    let tickSetting = {
                        period: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
                    };
                    await jobFundable.setVariable('_tick', { [approvedLiquidity.address]: tickSetting });
                });
                it('should update twaps for liquidity', async () => {
                    await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, bn_1.toUnit(1));
                    chai_1.expect(helper.observe).to.have.been.called;
                });
                it('should recalculate previous credits to current prices', async () => {
                    helper.getKP3RsAtTick.returns(([amount]) => {
                        return mathUtils.decrease1Tick(amount);
                    });
                    let previousJobCredits = mathUtils.calcPeriodCredits(previousJobLiquidityAmount);
                    await jobFundable.connect(provider).addLiquidityToJob(randomJob, approvedLiquidity.address, bn_1.toUnit(1));
                    chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.closeTo(mathUtils.decrease1Tick(previousJobCredits), mathUtils.blockShiftPrecision);
                });
            });
        });
    });
    describe('unbondLiquidityFromJob', () => {
        beforeEach(async () => {
            helper.observe.reset();
            helper.observe.returns([rewardPeriodTime, 0, true]);
        });
        behaviours_1.onlyJobOwner(() => jobFundable, 'unbondLiquidityFromJob', jobOwner, () => [randomJob, approvedLiquidity.address, bn_1.toUnit(1)]);
        it('should revert if job doesnt have the requested liquidity', async () => {
            await chai_1.expect(jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, bn_1.toUnit(1))).to.be.revertedWith('JobLiquidityUnexistent()');
        });
        context('when job has requested liquidity', () => {
            const jobLiquidityAmount = bn_1.toUnit(1);
            beforeEach(async () => {
                await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
                await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: jobLiquidityAmount } });
                await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: jobLiquidityAmount });
                await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: jobLiquidityAmount });
            });
            it('should revert if trying to withdraw more liquidity than the job has', async () => {
                await chai_1.expect(jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount.add(1))).to.be.revertedWith('JobLiquidityInsufficient()');
            });
            it('should not reset last reward timestamp', async () => {
                const previousRewardedAt = await jobFundable.rewardedAt(randomJob);
                await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
                chai_1.expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(previousRewardedAt);
            });
            it('should remove liquidity from job if all is unbonded', async () => {
                await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
                chai_1.expect(await jobFundable.internalJobLiquidities(randomJob)).to.deep.equal([]);
            });
            it('should update the period job accountance', async () => {
                await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
                chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.equal(0);
            });
            it('should unbond the liquidity', async () => {
                await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
                chai_1.expect(await jobFundable.callStatic.pendingUnbonds(randomJob, approvedLiquidity.address)).to.equal(jobLiquidityAmount);
            });
            it('should lock the unbonded liquidity', async () => {
                await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                const expectedLockTime = blockTimestamp + moment_1.default.duration(14, 'days').as('seconds');
                chai_1.expect(await jobFundable.callStatic.canWithdrawAfter(randomJob, approvedLiquidity.address)).to.equal(expectedLockTime);
            });
            it('should emit event', async () => {
                const tx = await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, approvedLiquidity.address, jobLiquidityAmount);
                await chai_1.expect(tx).to.emit(jobFundable, 'Unbonding').withArgs(randomJob, approvedLiquidity.address, jobLiquidityAmount);
            });
            context('when liquidity is revoked', () => {
                let revokedLiquidity;
                beforeEach(async () => {
                    await jobFundable.setRevokedLiquidity(approvedLiquidity.address);
                    revokedLiquidity = approvedLiquidity;
                });
                it('should be able to unbond', async () => {
                    await jobFundable.connect(jobOwner).unbondLiquidityFromJob(randomJob, revokedLiquidity.address, jobLiquidityAmount);
                    chai_1.expect(await jobFundable.callStatic.pendingUnbonds(randomJob, approvedLiquidity.address)).to.be.gt(0);
                });
            });
        });
    });
    describe('withdrawLiquidityFromJob', () => {
        let initialLiquidityAmount = bn_1.toUnit(1);
        beforeEach(async () => {
            await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: initialLiquidityAmount } });
            await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: bn_1.toUnit(1) });
            await jobFundable.setVariable('rewardedAt', { [randomJob]: 0 });
            helper.observe.reset();
            helper.observe.returns([rewardPeriodTime, 0, true]);
        });
        behaviours_1.onlyJobOwner(() => jobFundable, 'withdrawLiquidityFromJob', jobOwner, () => [randomJob, approvedLiquidity.address, jobOwner.address]);
        it('should revert if never unbonded', async () => {
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address)).to.be.revertedWith('UnbondsUnexistent()');
        });
        it('should revert if unbonded tokens are still locked', async () => {
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobFundable.setVariable('canWithdrawAfter', {
                [randomJob]: { [approvedLiquidity.address]: blockTimestamp + moment_1.default.duration('1', 'hour').asSeconds() },
            });
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address)).to.be.revertedWith('UnbondsLocked()');
        });
        it('should revert when receiver is zero address', async () => {
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, constants_1.ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
        });
        context('when unbonded tokens and waited', () => {
            const unbondedAmount = bn_1.toUnit(1);
            beforeEach(async () => {
                const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobFundable.setVariable('canWithdrawAfter', {
                    [randomJob]: { [approvedLiquidity.address]: blockTimestamp },
                });
                await jobFundable.setVariable('pendingUnbonds', {
                    [randomJob]: { [approvedLiquidity.address]: unbondedAmount },
                });
            });
            it('should revert if job is disputed', async () => {
                await jobFundable.setVariable('disputes', {
                    [randomJob]: true,
                });
                await chai_1.expect(jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address)).to.be.revertedWith('Disputed()');
            });
            it('should transfer unbonded liquidity to the receiver', async () => {
                await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, governance.address);
                chai_1.expect(approvedLiquidity.transfer).to.have.been.calledOnceWith(governance.address, unbondedAmount);
            });
            it('should emit event', async () => {
                const tx = await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address);
                await chai_1.expect(tx)
                    .to.emit(jobFundable, 'LiquidityWithdrawal')
                    .withArgs(randomJob, approvedLiquidity.address, jobOwner.address, unbondedAmount);
            });
            it('should reset the pending unbond amount', async () => {
                await jobFundable.connect(jobOwner).withdrawLiquidityFromJob(randomJob, approvedLiquidity.address, jobOwner.address);
                chai_1.expect(await jobFundable.pendingUnbonds(randomJob, approvedLiquidity.address)).to.equal(0);
            });
        });
    });
    describe('_settleJobAccountance', () => {
        let calculatedJobPeriodCredits;
        let blockTimestamp;
        beforeEach(async () => {
            const jobLiquidityAmount = bn_1.toUnit(10);
            calculatedJobPeriodCredits = mathUtils.calcPeriodCredits(jobLiquidityAmount);
            await jobFundable.setJobLiquidity(randomJob, approvedLiquidity.address);
            await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: calculatedJobPeriodCredits });
            await jobFundable.setVariable('_liquidityPool', { [approvedLiquidity.address]: oraclePool.address });
            await jobFundable.setVariable('liquidityAmount', { [randomJob]: { [approvedLiquidity.address]: jobLiquidityAmount } });
            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
        });
        it('should update job credits to current quote', async () => {
            helper.getKP3RsAtTick.returns(([amount]) => {
                return mathUtils.decrease1Tick(amount);
            });
            await jobFundable.connect(provider).internalJobLiquidities(randomJob);
            chai_1.expect(await jobFundable.jobPeriodCredits(randomJob)).to.be.closeTo(mathUtils.decrease1Tick(calculatedJobPeriodCredits), mathUtils.blockShiftPrecision);
        });
        it('should reward all job pending credits', async () => {
            await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: calculatedJobPeriodCredits });
            await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp) });
            // The job has 0 credits but should be rewarded some
            chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(0);
            await jobFundable.internalSettleJobAccountance(randomJob);
            chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.gt(0);
        });
        it('should max the possible credits to 1 period', async () => {
            await jobFundable.setVariable('_jobLiquidityCredits', { [randomJob]: calculatedJobPeriodCredits });
            await jobFundable.setVariable('_jobPeriodCredits', { [randomJob]: calculatedJobPeriodCredits });
            await jobFundable.setVariable('rewardedAt', { [randomJob]: mathUtils.calcPeriod(blockTimestamp) });
            await jobFundable.internalSettleJobAccountance(randomJob);
            chai_1.expect(await jobFundable.jobLiquidityCredits(randomJob)).to.be.eq(calculatedJobPeriodCredits);
        });
        it('should set job reward timestamp to current timestamp', async () => {
            await jobFundable.internalSettleJobAccountance(randomJob);
            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            chai_1.expect(await jobFundable.rewardedAt(randomJob)).to.be.eq(blockTimestamp);
        });
    });
});
