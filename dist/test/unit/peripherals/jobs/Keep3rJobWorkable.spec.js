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
const event_utils_1 = require("@utils/event-utils");
const math_1 = require("@utils/math");
const chai_1 = __importStar(require("chai"));
const ethers_1 = require("ethers");
const hardhat_1 = require("hardhat");
const moment_1 = __importDefault(require("moment"));
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rJobWorkable', () => {
    let jobWorkable;
    let helper;
    let keep3rV1;
    let keep3rV1Proxy;
    let randomLiquidity;
    let randomKeeper;
    let approvedJob;
    let jobWorkableFactory;
    let kp3rWethPool;
    let oraclePool;
    // Parameter and function equivalent to contract's
    let rewardPeriodTime;
    let inflationPeriodTime;
    let mathUtils;
    before(async () => {
        [, randomKeeper, approvedJob] = await hardhat_1.ethers.getSigners();
        jobWorkableFactory = await smock_1.smock.mock('Keep3rJobWorkableForTest');
    });
    beforeEach(async () => {
        helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        randomLiquidity = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        kp3rWethPool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        helper.isKP3RToken0.returns(true);
        jobWorkable = await jobWorkableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, kp3rWethPool.address);
        await jobWorkable.setJob(approvedJob.address);
        rewardPeriodTime = (await jobWorkable.rewardPeriodTime()).toNumber();
        inflationPeriodTime = (await jobWorkable.inflationPeriod()).toNumber();
        mathUtils = math_1.mathUtilsFactory(rewardPeriodTime, inflationPeriodTime);
        const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
        const testPeriodTime = mathUtils.calcPeriod(blockTimestamp + rewardPeriodTime) + rewardPeriodTime / 2;
        // set the test to start mid-period
        _utils_1.evm.advanceToTime(testPeriodTime);
        _utils_1.evm.advanceBlock();
        // set kp3rWethPool to be set and updated
        await jobWorkable.setVariable('_tick', { [kp3rWethPool.address]: { period: mathUtils.calcPeriod(testPeriodTime) } });
    });
    describe('isKeeper', () => {
        it('should return false if keeper is not registered', async () => {
            chai_1.expect(await jobWorkable.callStatic.isKeeper(randomKeeper.address)).to.be.false;
        });
        it('should return true if keeper is registered', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            chai_1.expect(await jobWorkable.callStatic.isKeeper(randomKeeper.address)).to.be.true;
        });
        it('should initialize the gas accountance', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            chai_1.expect(await jobWorkable.callStatic.viewGas()).to.be.eq(0);
            await jobWorkable.isKeeper(randomKeeper.address);
            chai_1.expect(await jobWorkable.callStatic.viewGas()).to.be.gt(0);
        });
        it('should emit event', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            const gasLimit = ethers_1.BigNumber.from(30000000);
            const tx = await jobWorkable.isKeeper(randomKeeper.address, { gasLimit });
            const gasUsed = (await tx.wait()).gasUsed;
            const gasRecord = await event_utils_1.readArgFromEvent(tx, 'KeeperValidation', '_gasLeft');
            await chai_1.expect(tx).to.emit(jobWorkable, 'KeeperValidation');
            chai_1.expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 2000);
        });
    });
    describe('isBondedKeeper', () => {
        it('should return false if address is not a keeper', async () => {
            chai_1.expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, 0, 0)).to.be.false;
        });
        it('should return false if keeper does not fulfill bonds', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            chai_1.expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, bn_1.toUnit(1), 0, 0)).to.be.false;
        });
        it('should return false if keeper does not fulfill earned', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            chai_1.expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, bn_1.toUnit(1), 0)).to.be.false;
        });
        it('should return false if keeper does not fulfill age', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobWorkable.setVariable('firstSeen', { [randomKeeper.address]: blockTimestamp });
            chai_1.expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, 0, 1)).to.be.false;
        });
        it('should return true if keeper fulfill all the requirements', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobWorkable.setVariable('bonds', { [randomKeeper.address]: { [randomLiquidity.address]: bn_1.toUnit(1) } });
            await jobWorkable.setVariable('workCompleted', { [randomKeeper.address]: bn_1.toUnit(1) });
            await jobWorkable.setVariable('firstSeen', { [randomKeeper.address]: blockTimestamp - 1 });
            chai_1.expect(await jobWorkable.callStatic.isBondedKeeper(randomKeeper.address, randomLiquidity.address, bn_1.toUnit(1), bn_1.toUnit(1), 1)).to.be.true;
        });
        it('should emit event', async () => {
            await jobWorkable.setKeeper(randomKeeper.address);
            const gasLimit = ethers_1.BigNumber.from(30000000);
            const tx = await jobWorkable.isBondedKeeper(randomKeeper.address, randomLiquidity.address, 0, 0, 0, { gasLimit });
            const gasUsed = (await tx.wait()).gasUsed;
            const gasRecord = await event_utils_1.readArgFromEvent(tx, 'KeeperValidation', '_gasLeft');
            await chai_1.expect(tx).to.emit(jobWorkable, 'KeeperValidation');
            chai_1.expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 2000);
        });
    });
    describe('worked', () => {
        it('should revert when called with unallowed job', async () => {
            await chai_1.expect(jobWorkable.worked(randomKeeper.address)).to.be.revertedWith('JobUnapproved()');
        });
        it('should revert if job is disputed', async () => {
            await jobWorkable.setVariable('disputes', {
                [approvedJob.address]: true,
            });
            await chai_1.expect(jobWorkable.connect(approvedJob).worked(randomKeeper.address)).to.be.revertedWith('JobDisputed()');
        });
        context('when job is allowed', () => {
            let blockTimestamp;
            let jobCredits;
            let oneTenth;
            let oneTick;
            beforeEach(async () => {
                oneTenth = -23027 * rewardPeriodTime;
                oneTick = rewardPeriodTime;
                // 1.0001^-23027 => 1ETH / 10KP3R
                // 1.0001^1 => 1 tickDifference
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobWorkable.setJob(approvedJob.address);
                await jobWorkable.setVariable('_isKP3RToken0', { [oraclePool.address]: true });
                await jobWorkable.setApprovedLiquidity(randomLiquidity.address);
                await jobWorkable.setVariable('_liquidityPool', { [randomLiquidity.address]: oraclePool.address });
                await jobWorkable.setJobLiquidity(approvedJob.address, randomLiquidity.address);
                await jobWorkable.setVariable('_initialGas', 1500000);
                const liquidityToAdd = bn_1.toUnit(1);
                jobCredits = mathUtils.calcPeriodCredits(liquidityToAdd);
                await jobWorkable.setVariable('liquidityAmount', { [approvedJob.address]: { [randomLiquidity.address]: liquidityToAdd } });
                helper.observe.returns([oneTick, 0, true]);
            });
            it('should emit event', async () => {
                // work pays no gas to the keeper
                helper.getRewardBoostFor.returns(0);
                const gasLimit = ethers_1.BigNumber.from(30000000);
                await jobWorkable.setVariable('_initialGas', gasLimit);
                const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit });
                const eventArgs = (await event_utils_1.readArgsFromEvent(tx, 'KeeperWork'))[0];
                const gasUsed = (await tx.wait()).gasUsed;
                const gasRecord = await event_utils_1.readArgFromEvent(tx, 'KeeperWork', '_gasLeft');
                chai_1.expect(eventArgs.slice(0, -1)).to.be.deep.eq([keep3rV1.address, approvedJob.address, randomKeeper.address, ethers_1.BigNumber.from(0)]);
                chai_1.expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 3000);
            });
            it('should update KP3R/WETH quote if needed', async () => {
                // let a period pass to outdate the current quote
                await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(10, 'days').as('seconds'));
                // set oracle response
                const currentTick = oneTick;
                const previousTick = 0;
                const tickDifference = currentTick - previousTick;
                kp3rWethPool.observe.returns([[currentTick, previousTick], []]);
                // job awards no credits to keeper
                helper.getRewardBoostFor.returns(0);
                await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                chai_1.expect(helper.observe).to.have.been.calledWith(kp3rWethPool.address, [
                    blockTimestamp - mathUtils.calcPeriod(blockTimestamp),
                    blockTimestamp - mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime),
                ]);
                chai_1.expect(await jobWorkable.viewTickCache(kp3rWethPool.address)).to.deep.equal([
                    ethers_1.BigNumber.from(currentTick),
                    ethers_1.BigNumber.from(tickDifference),
                    ethers_1.BigNumber.from(mathUtils.calcPeriod(blockTimestamp)),
                ]);
            });
            it('should update job credits if needed', async () => {
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                // job rewarded mid last period but less than a rewardPeriodTime ago
                const previousRewardedAt = blockTimestamp + 100 - rewardPeriodTime;
                await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
                await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
                await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
                // work pays no gas to the keeper
                helper.getRewardBoostFor.returns(0);
                helper.getKP3RsAtTick.returns(([amount]) => {
                    return mathUtils.increase1Tick(amount);
                });
                await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                // work updates jobCredits to current twap price
                chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.closeTo(mathUtils.increase1Tick(jobCredits), mathUtils.blockShiftPrecision);
                // work does not reward the job
                chai_1.expect(await jobWorkable.rewardedAt(approvedJob.address)).to.be.eq(previousRewardedAt);
            });
            context('when credits are outdated', () => {
                beforeEach(async () => {
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
                    await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
                    // work pays no gas to the keeper
                    helper.getRewardBoostFor.returns(0);
                    // job was rewarded last period >> should be rewarded this period
                    const previousRewardedAt = mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime);
                    await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
                });
                it('should reward job with period credits', async () => {
                    await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
                    await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: jobCredits });
                    helper.getRewardBoostFor.returns(0);
                    await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                    chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(await jobWorkable.jobPeriodCredits(approvedJob.address));
                });
                it('should emit event', async () => {
                    await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: jobCredits });
                    const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    await chai_1.expect(tx)
                        .to.emit(jobWorkable, 'LiquidityCreditsReward')
                        .withArgs(approvedJob.address, mathUtils.calcPeriod(blockTimestamp), await jobWorkable.jobLiquidityCredits(approvedJob.address), await jobWorkable.jobPeriodCredits(approvedJob.address));
                });
            });
            context('when job credits are not enough for payment', () => {
                beforeEach(async () => {
                    helper.observe.returns([oneTenth, 0, true]);
                    helper.getKP3RsAtTick.returns(([amount]) => {
                        return amount.div(10);
                    });
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    // work pays more gas than current credits
                    // rewardETH = gasUsed * 120% * 20Gwei
                    // rewardKP3R = rewardETH / oneTenth
                    helper.getRewardBoostFor.returns(bn_1.toGwei(20).mul(1.2 * 10000));
                    // job rewarded mid last period but less than a rewardPeriodTime ago
                    const previousRewardedAt = blockTimestamp + 15 - rewardPeriodTime;
                    await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: previousRewardedAt });
                });
                it('should reward job', async () => {
                    await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: bn_1.toUnit(1) });
                    await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) });
                    await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    // work does reward the job at current timestamp
                    chai_1.expect(await jobWorkable.rewardedAt(approvedJob.address)).to.be.eq(blockTimestamp);
                    // work rewards job and pays the keeper
                    chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.gt(0);
                });
                it('should reward job twice if credits where outdated', async () => {
                    await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(1, 'days').as('seconds'));
                    await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp - rewardPeriodTime) });
                    helper.getRewardBoostFor.returns(bn_1.toGwei(200).mul(1.2 * 10000));
                    const tx = await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                    blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                    const jobPeriodCredits = await jobWorkable.jobPeriodCredits(approvedJob.address);
                    /* Expectation: 2 event emitted
                    // 1- rewarding the job with current period credits
                    // 2- rewarding the job with minted credits since current period
                    */
                    await chai_1.expect(tx)
                        .to.emit(jobWorkable, 'LiquidityCreditsReward')
                        .withArgs(approvedJob.address, mathUtils.calcPeriod(blockTimestamp), jobPeriodCredits, jobPeriodCredits);
                    await chai_1.expect(tx)
                        .to.emit(jobWorkable, 'LiquidityCreditsReward')
                        .withArgs(approvedJob.address, blockTimestamp, jobPeriodCredits.add(mathUtils.calcMintedCredits(jobPeriodCredits, blockTimestamp - mathUtils.calcPeriod(blockTimestamp))), jobPeriodCredits);
                });
                it('should update payment with extra gas used by the keeper', async () => {
                    await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: bn_1.toUnit(10) });
                    await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) });
                    await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                    const bondsAcc1 = await jobWorkable.bonds(randomKeeper.address, keep3rV1.address);
                    // second job shouldn't reward the job and earn less KP3R
                    await jobWorkable.connect(approvedJob).worked(randomKeeper.address, { gasLimit: 1000000 });
                    const bondsAcc2 = await jobWorkable.bonds(randomKeeper.address, keep3rV1.address);
                    chai_1.expect(bondsAcc1).to.be.gt(bondsAcc2.sub(bondsAcc1));
                });
            });
        });
    });
    describe('bondedPayment', () => {
        it('should revert when called with unallowed job', async () => {
            await chai_1.expect(jobWorkable.bondedPayment(randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('JobUnapproved()');
        });
        it('should revert when the job does not have any liquidity', async () => {
            await chai_1.expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('InsufficientFunds()');
        });
        it('should revert if job is disputed', async () => {
            await jobWorkable.setVariable('disputes', {
                [approvedJob.address]: true,
            });
            await chai_1.expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('JobDisputed()');
        });
        context('when job has updated liquidity credits', () => {
            let blockTimestamp;
            const initialJobCredits = bn_1.toUnit(100);
            beforeEach(async () => {
                _utils_1.evm.advanceTime(moment_1.default.duration(1, 'days').as('seconds'));
                await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: initialJobCredits });
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: mathUtils.calcPeriod(blockTimestamp) });
            });
            it('should not revert', async () => {
                await chai_1.expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1))).not.to.be.reverted;
            });
        });
        context('when job has added liquidity', () => {
            let blockTimestamp;
            const initialJobLiquidity = bn_1.toUnit(100);
            beforeEach(async () => {
                await jobWorkable.setJobLiquidity(approvedJob.address, randomLiquidity.address);
                await jobWorkable.setVariable('liquidityAmount', { [approvedJob.address]: { [randomLiquidity.address]: initialJobLiquidity } });
                await jobWorkable.setVariable('_jobPeriodCredits', { [approvedJob.address]: initialJobLiquidity });
                blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                await jobWorkable.setVariable('_tick', { [randomLiquidity.address]: { period: mathUtils.calcPeriod(blockTimestamp) } });
            });
            context('when liquidity is not approved', () => {
                it('should revert with InsufficientFunds', async () => {
                    await chai_1.expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('InsufficientFunds');
                });
            });
            context('when liquidity is approved', () => {
                beforeEach(async () => {
                    await jobWorkable.setApprovedLiquidity(randomLiquidity.address);
                    helper.getKP3RsAtTick.returns(([amount]) => amount);
                });
                it('should substract payed credits', async () => {
                    await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                    const jobCredits = mathUtils.calcPeriodCredits(initialJobLiquidity);
                    chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(jobCredits.sub(bn_1.toUnit(1)));
                });
                it('should emit event', async () => {
                    const payment = bn_1.toUnit(1);
                    const gasLimit = ethers_1.BigNumber.from(30000000);
                    const tx = await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, payment, { gasLimit });
                    const gasUsed = (await tx.wait()).gasUsed;
                    const eventArgs = (await event_utils_1.readArgsFromEvent(tx, 'KeeperWork'))[0];
                    const gasRecord = await event_utils_1.readArgFromEvent(tx, 'KeeperWork', '_gasLeft');
                    chai_1.expect(eventArgs.slice(0, -1)).to.be.deep.eq([keep3rV1.address, approvedJob.address, randomKeeper.address, payment]);
                    chai_1.expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 3000);
                });
                it('should record job last worked timestamp', async () => {
                    await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                    const workBlock = await hardhat_1.ethers.provider.getBlock('latest');
                    chai_1.expect(await jobWorkable.workedAt(approvedJob.address)).to.be.equal(workBlock.timestamp);
                });
                context('when liquidity credits are less than payment amount', () => {
                    beforeEach(async () => {
                        await jobWorkable.setVariable('_jobLiquidityCredits', { [approvedJob.address]: bn_1.toUnit(0) });
                    });
                    context('when job has not minted enough credits to pay', async () => {
                        beforeEach(async () => {
                            jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: blockTimestamp });
                        });
                        it('should revert with InsufficientFunds', async () => {
                            await chai_1.expect(jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1))).to.be.reverted;
                        });
                    });
                    context('when job has minted enough credits', () => {
                        beforeEach(async () => {
                            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                            await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: blockTimestamp - 0.9 * rewardPeriodTime });
                        });
                        it('should reward the job with pending credits and pay the keeper', async () => {
                            const jobCredits = mathUtils.calcPeriodCredits(initialJobLiquidity);
                            const previousJobLiquidityCredits = await jobWorkable.jobLiquidityCredits(approvedJob.address);
                            // A second has passed
                            await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                            chai_1.expect(await jobWorkable.jobPeriodCredits(approvedJob.address)).to.be.eq(jobCredits);
                            chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.gt(previousJobLiquidityCredits);
                        });
                        it('should update the job last rewarded timestamp', async () => {
                            await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                            chai_1.expect(await jobWorkable.rewardedAt(approvedJob.address)).to.be.eq(blockTimestamp);
                        });
                        it('should not have any pending credits', async () => {
                            await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                            chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(await jobWorkable.totalJobCredits(approvedJob.address));
                        });
                    });
                    context('when job has minted more than a period of credits', () => {
                        beforeEach(async () => {
                            await jobWorkable.setVariable('rewardedAt', { [approvedJob.address]: blockTimestamp - 1.1 * rewardPeriodTime });
                        });
                        it('should reward the job with a full period of credits', async () => {
                            let jobPeriodCredits = await jobWorkable.jobPeriodCredits(approvedJob.address);
                            await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                            chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.eq(jobPeriodCredits.sub(bn_1.toUnit(1)));
                        });
                        it('should still have some pending credits', async () => {
                            await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                            blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
                            chai_1.expect(await jobWorkable.rewardedAt(approvedJob.address)).not.to.be.eq(blockTimestamp);
                            chai_1.expect(await jobWorkable.jobLiquidityCredits(approvedJob.address)).to.be.lt(await jobWorkable.totalJobCredits(approvedJob.address));
                        });
                    });
                });
                context('reward', () => {
                    it('should increase keeper KP3R bonds', async () => {
                        await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                        chai_1.expect(await jobWorkable.bonds(randomKeeper.address, keep3rV1.address)).to.equal(bn_1.toUnit(1));
                    });
                    it('should increase total KP3R bonded', async () => {
                        await jobWorkable.connect(approvedJob).bondedPayment(randomKeeper.address, bn_1.toUnit(1));
                        chai_1.expect(await jobWorkable.bonds(randomKeeper.address, keep3rV1.address)).to.equal(bn_1.toUnit(1));
                    });
                });
            });
        });
    });
    describe('directTokenPayment', () => {
        let token;
        beforeEach(async () => {
            token = await smock_1.smock.fake(ERC20_json_1.default.abi);
            token.transfer.returns(true);
        });
        it('should revert when called with unallowed job', async () => {
            await chai_1.expect(jobWorkable.directTokenPayment(token.address, randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('JobUnapproved()');
        });
        it('should revert when the keeper is disputed', async () => {
            await jobWorkable.setVariable('disputes', {
                [randomKeeper.address]: true,
            });
            await chai_1.expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('Disputed()');
        });
        it('should revert when the job does not have enought credits', async () => {
            await chai_1.expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('InsufficientFunds()');
        });
        it('should revert if job is disputed', async () => {
            await jobWorkable.setVariable('disputes', {
                [approvedJob.address]: true,
            });
            await chai_1.expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('JobDisputed()');
        });
        context('when job has token credits', () => {
            const initialJobCredits = bn_1.toUnit(5);
            beforeEach(async () => {
                await jobWorkable.setVariable('jobTokenCredits', {
                    [approvedJob.address]: {
                        [token.address]: initialJobCredits,
                    },
                });
            });
            it('should revert if transfer fails', async () => {
                token.transfer.returns(false);
                await chai_1.expect(jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, bn_1.toUnit(1))).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
            });
            it('should substract payed credits', async () => {
                await jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, bn_1.toUnit(1));
                chai_1.expect(await jobWorkable.jobTokenCredits(approvedJob.address, token.address)).to.be.equal(initialJobCredits.sub(bn_1.toUnit(1)));
            });
            it('should transfer tokens to the keeper', async () => {
                await jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, bn_1.toUnit(1));
                chai_1.expect(token.transfer).to.be.calledOnceWith(randomKeeper.address, bn_1.toUnit(1));
            });
            it('should emit event', async () => {
                const payment = bn_1.toUnit(1);
                const gasLimit = ethers_1.BigNumber.from(30000000);
                const tx = await jobWorkable.connect(approvedJob).directTokenPayment(token.address, randomKeeper.address, payment, { gasLimit });
                const gasUsed = (await tx.wait()).gasUsed;
                const gasRecord = await event_utils_1.readArgFromEvent(tx, 'KeeperWork', '_gasLeft');
                const eventArgs = await event_utils_1.readArgsFromEvent(tx, 'KeeperWork');
                chai_1.expect(eventArgs[0].slice(0, -1)).to.be.deep.eq([token.address, approvedJob.address, randomKeeper.address, payment]);
                chai_1.expect(gasRecord).to.be.closeTo(gasLimit.sub(gasUsed), 3000);
            });
        });
    });
});
