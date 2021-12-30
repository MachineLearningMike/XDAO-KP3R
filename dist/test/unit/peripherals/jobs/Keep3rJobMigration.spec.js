"use strict";
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
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
const moment_1 = __importDefault(require("moment"));
describe('Keep3rJobMigration', () => {
    const fromJob = _utils_1.wallet.generateRandomAddress();
    const toJob = _utils_1.wallet.generateRandomAddress();
    let fromJobOwner;
    let toJobOwner;
    let jobMigration;
    let jobMigrationFactory;
    before(async () => {
        [, fromJobOwner, toJobOwner] = await hardhat_1.ethers.getSigners();
        jobMigrationFactory = await smock_1.smock.mock('Keep3rJobMigrationForTest');
    });
    beforeEach(async () => {
        const helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        const keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        const keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        const oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        helper.observe.returns([0, 0, true]);
        jobMigration = await jobMigrationFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
        await jobMigration.setVariable('jobOwner', {
            [fromJob]: fromJobOwner.address,
        });
        await jobMigration.setVariable('jobOwner', {
            [toJob]: toJobOwner.address,
        });
    });
    describe('migrateJob', () => {
        behaviours_1.onlyJobOwner(() => jobMigration, 'migrateJob', fromJobOwner, [fromJob, toJob]);
        it('should revert if migration targets the same job', async () => {
            await chai_1.expect(jobMigration.connect(fromJobOwner).migrateJob(fromJob, fromJob)).to.be.revertedWith('JobMigrationImpossible()');
        });
        it('should create a job migration request', async () => {
            await jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob);
            chai_1.expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(toJob);
        });
        it('should overwrite previous migration request', async () => {
            await jobMigration.connect(fromJobOwner).migrateJob(fromJob, _utils_1.wallet.generateRandomAddress());
            await jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob);
            chai_1.expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(toJob);
        });
        it('should emit event', async () => {
            await chai_1.expect(jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob))
                .to.emit(jobMigration, 'JobMigrationRequested')
                .withArgs(fromJob, toJob);
        });
        context('when sending zero address', async () => {
            it('should cancel migration', async () => {
                await jobMigration.connect(fromJobOwner).migrateJob(fromJob, toJob);
                await jobMigration.connect(fromJobOwner).migrateJob(fromJob, constants_1.ZERO_ADDRESS);
                chai_1.expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(constants_1.ZERO_ADDRESS);
            });
            it('should emit event', async () => {
                await chai_1.expect(jobMigration.connect(fromJobOwner).migrateJob(fromJob, constants_1.ZERO_ADDRESS))
                    .to.emit(jobMigration, 'JobMigrationRequested')
                    .withArgs(fromJob, constants_1.ZERO_ADDRESS);
            });
        });
    });
    describe('acceptJobMigration', () => {
        const tokenA = _utils_1.wallet.generateRandomAddress();
        const tokenB = _utils_1.wallet.generateRandomAddress();
        const tokenC = _utils_1.wallet.generateRandomAddress();
        const liquidityA = _utils_1.wallet.generateRandomAddress();
        const liquidityB = _utils_1.wallet.generateRandomAddress();
        const liquidityC = _utils_1.wallet.generateRandomAddress();
        const fromJobTokenAAmount = bn_1.toUnit(1);
        const fromJobTokenBAmount = bn_1.toUnit(2);
        const toJobTokenBAmount = bn_1.toUnit(3);
        const toJobTokenCAmount = bn_1.toUnit(4);
        const fromJobLiquidityAAmount = bn_1.toUnit(1);
        const fromJobLiquidityBAmount = bn_1.toUnit(2);
        const toJobLiquidityBAmount = bn_1.toUnit(3);
        const toJobLiquidityCAmount = bn_1.toUnit(4);
        const fromJobPeriodCredits = bn_1.toUnit(1);
        const toJobPeriodCredits = bn_1.toUnit(2);
        const fromJobLiquidityCredits = bn_1.toUnit(3);
        const toJobLiquidityCredits = bn_1.toUnit(4);
        beforeEach(async () => {
            await jobMigration.setJobToken(fromJob, tokenA);
            await jobMigration.setJobToken(fromJob, tokenB);
            await jobMigration.setJobToken(toJob, tokenB);
            await jobMigration.setJobToken(toJob, tokenC);
            await jobMigration.setVariable('jobTokenCredits', {
                [fromJob]: {
                    [tokenA]: fromJobTokenAAmount,
                    [tokenB]: fromJobTokenBAmount,
                },
                [toJob]: {
                    [tokenB]: toJobTokenBAmount,
                    [tokenC]: toJobTokenCAmount,
                },
            });
            await jobMigration.setVariable('pendingJobMigrations', {
                [fromJob]: toJob,
            });
            await jobMigration.setVariable('_migrationCreatedAt', {
                [fromJob]: { [toJob]: (await hardhat_1.ethers.provider.getBlock('latest')).timestamp },
            });
            await jobMigration.setJobLiquidity(fromJob, liquidityA);
            await jobMigration.setJobLiquidity(fromJob, liquidityB);
            await jobMigration.setJobLiquidity(toJob, liquidityB);
            await jobMigration.setJobLiquidity(toJob, liquidityC);
            await jobMigration.setVariable('liquidityAmount', {
                [fromJob]: {
                    [liquidityA]: fromJobLiquidityAAmount,
                    [liquidityB]: fromJobLiquidityBAmount,
                },
                [toJob]: {
                    [liquidityB]: toJobLiquidityBAmount,
                    [liquidityC]: toJobLiquidityCAmount,
                },
            });
            await jobMigration.setVariable('_jobPeriodCredits', {
                [fromJob]: fromJobPeriodCredits,
                [toJob]: toJobPeriodCredits,
            });
            await jobMigration.setVariable('_jobLiquidityCredits', {
                [fromJob]: fromJobLiquidityCredits,
                [toJob]: toJobLiquidityCredits,
            });
        });
        behaviours_1.onlyJobOwner(() => jobMigration, 'acceptJobMigration', toJobOwner, [fromJob, toJob]);
        it('should revert if requested migration does not exist', async () => {
            await chai_1.expect(jobMigration.connect(fromJobOwner).acceptJobMigration(toJob, fromJob)).to.be.revertedWith('JobMigrationUnavailable()');
        });
        it('should revert if fromJob is disputed', async () => {
            await jobMigration.setVariable('disputes', { [fromJob]: true });
            await chai_1.expect(jobMigration.connect(fromJobOwner).acceptJobMigration(toJob, fromJob)).to.be.revertedWith('JobDisputed()');
        });
        it('should revert if toJob is disputed', async () => {
            await jobMigration.setVariable('disputes', { [toJob]: true });
            await chai_1.expect(jobMigration.connect(fromJobOwner).acceptJobMigration(toJob, fromJob)).to.be.revertedWith('JobDisputed()');
        });
        it('should revert if cooldown period did not end', async () => {
            await chai_1.expect(jobMigration.connect(toJobOwner).acceptJobMigration(fromJob, toJob)).to.be.revertedWith('JobMigrationLocked()');
        });
        context('when accepting the migration after the cooldown period', () => {
            let tx;
            beforeEach(async () => {
                await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(1, 'minute').as('seconds'));
                tx = await jobMigration.connect(toJobOwner).acceptJobMigration(fromJob, toJob);
            });
            it('should settle fromJob accountance', async () => {
                chai_1.expect(await jobMigration.settleJobAccountanceCallCount(fromJob)).to.equal(1);
            });
            it('should settle toJob accountance', async () => {
                chai_1.expect(await jobMigration.settleJobAccountanceCallCount(toJob)).to.equal(1);
            });
            it('should empty original job token credits', async () => {
                chai_1.expect(await jobMigration.jobTokenCredits(fromJob, tokenA)).to.equal(0);
                chai_1.expect(await jobMigration.jobTokenCredits(fromJob, tokenB)).to.equal(0);
                chai_1.expect(await jobMigration.jobTokenCredits(fromJob, tokenC)).to.equal(0);
                chai_1.expect(await jobMigration.viewJobTokenListLength(fromJob)).to.equal(0);
            });
            it('should add all token credits to the target job', async () => {
                chai_1.expect(await jobMigration.jobTokenCredits(toJob, tokenA)).to.equal(fromJobTokenAAmount);
                chai_1.expect(await jobMigration.jobTokenCredits(toJob, tokenB)).to.equal(fromJobTokenBAmount.add(toJobTokenBAmount));
                chai_1.expect(await jobMigration.jobTokenCredits(toJob, tokenC)).to.equal(toJobTokenCAmount);
                chai_1.expect(await jobMigration.viewJobTokenListLength(toJob)).to.equal(3);
            });
            it('should remove the job migration request', async () => {
                chai_1.expect(await jobMigration.pendingJobMigrations(fromJob)).to.equal(constants_1.ZERO_ADDRESS);
            });
            it('should add liquidity amounts from fromJob to toJob', async () => {
                chai_1.expect(await jobMigration.liquidityAmount(toJob, liquidityA)).to.equal(fromJobLiquidityAAmount);
                chai_1.expect(await jobMigration.liquidityAmount(toJob, liquidityB)).to.equal(fromJobLiquidityBAmount.add(toJobLiquidityBAmount));
                chai_1.expect(await jobMigration.liquidityAmount(toJob, liquidityC)).to.equal(toJobLiquidityCAmount);
            });
            it('should reset fromJob liquidity amounts', async () => {
                chai_1.expect(await jobMigration.liquidityAmount(fromJob, liquidityA)).to.equal(0);
                chai_1.expect(await jobMigration.liquidityAmount(fromJob, liquidityB)).to.equal(0);
            });
            it('should empty liquidy list from fromJob', async () => {
                chai_1.expect(await jobMigration.viewJobLiquidityList(fromJob)).to.deep.equal([]);
            });
            it('should fill liquidity list from toJob', async () => {
                chai_1.expect(await jobMigration.viewJobLiquidityList(toJob)).to.deep.equal([liquidityB, liquidityC, liquidityA]);
            });
            it('should add fromJob period credits to toJob', async () => {
                chai_1.expect(await jobMigration.viewJobPeriodCredits(toJob)).to.equal(fromJobPeriodCredits.add(toJobPeriodCredits));
            });
            it('should reset fromJob period credits', async () => {
                chai_1.expect(await jobMigration.jobPeriodCredits(fromJob)).to.equal(0);
            });
            it('should add fromJob liquidity credits to toJob', async () => {
                chai_1.expect(await jobMigration.viewJobLiquidityCredits(toJob)).to.equal(fromJobLiquidityCredits.add(toJobLiquidityCredits));
            });
            it('should reset fromJob liquidity credits', async () => {
                chai_1.expect(await jobMigration.viewJobLiquidityCredits(fromJob)).to.equal(0);
            });
            it('should reset fromJob rewardedAt', async () => {
                chai_1.expect(await jobMigration.rewardedAt(fromJob)).to.equal(0);
            });
            it('should stop fromJob from being a job', async () => {
                chai_1.expect(await jobMigration.isJob(fromJob)).to.be.false;
            });
            it('should delete fromJob owner', async () => {
                chai_1.expect(await jobMigration.jobOwner(fromJob)).to.be.eq(constants_1.ZERO_ADDRESS);
            });
            it('should delete fromJob pending owner', async () => {
                chai_1.expect(await jobMigration.jobPendingOwner(fromJob)).to.be.eq(constants_1.ZERO_ADDRESS);
            });
            it('should delete migration creation timestamp', async () => {
                chai_1.expect(await jobMigration.viewMigrationCreatedAt(fromJob, toJob)).to.be.eq(0);
            });
            it('should emit event', async () => {
                await chai_1.expect(tx).to.emit(jobMigration, 'JobMigrationSuccessful').withArgs(fromJob, toJob);
            });
        });
    });
});
