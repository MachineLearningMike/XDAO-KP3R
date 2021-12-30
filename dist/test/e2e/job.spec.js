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
describe('@skip-on-coverage Job', () => {
    let jobOwner;
    let richGuy;
    let keeper;
    let keep3r;
    let job;
    let pair;
    let governance;
    let snapshotId;
    // Parameter and function equivalent to contract's
    let rewardPeriodTime;
    before(async () => {
        await _utils_1.evm.reset({
            jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
            blockNumber: common.FORK_BLOCK_NUMBER,
        });
        jobOwner = await _utils_1.wallet.impersonate(common.RICH_ETH_ADDRESS);
        keeper = await _utils_1.wallet.generateRandomWithEth(bn_1.toUnit(10));
        ({ keep3r, governance } = await common.setupKeep3r());
        rewardPeriodTime = (await keep3r.rewardPeriodTime()).toNumber();
        job = await common.createJobForTest(keep3r.address, jobOwner);
        pair = await common.createLiquidityPair(governance);
        richGuy = await _utils_1.wallet.impersonate(common.RICH_KP3R_ADDRESS);
        await activateKeeper(keeper);
        snapshotId = await evm_1.snapshot.take();
    });
    beforeEach(async () => {
        await evm_1.snapshot.revert(snapshotId);
    });
    it('should fail to add liquidity to an unnaproved pool', async () => {
        await chai_1.expect(keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, bn_1.toUnit(1))).to.be.revertedWith('LiquidityPairUnapproved()');
    });
    it('should not be able to add liquidity to an unexistent job', async () => {
        await keep3r.connect(governance).approveLiquidity(pair.address);
        await chai_1.expect(keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, bn_1.toUnit(1))).to.be.revertedWith('JobUnavailable()');
    });
    context('when adding an approved liquidity on an existent job', () => {
        const liquidityAdded = bn_1.toUnit(100);
        let initialLiquidity;
        let spentKp3rs;
        beforeEach(async () => {
            // make twap stable for calculations
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(30, 'days').as('seconds'));
            // create job and add liquidity to it
            await keep3r.connect(jobOwner).addJob(job.address);
            await keep3r.connect(governance).approveLiquidity(pair.address);
            const response = await common.addLiquidityToPair(richGuy, pair, liquidityAdded, jobOwner);
            initialLiquidity = response.liquidity;
            spentKp3rs = response.spentKp3rs;
            await pair.connect(jobOwner).approve(keep3r.address, initialLiquidity);
            await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, initialLiquidity);
        });
        it('should generate liquidity credits from liquidity added to job', async () => {
            // should not have any credits inmediately after inserting liquidity into a job
            chai_1.expect(await keep3r.totalJobCredits(job.address)).to.equal(0);
            // wait some time
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(2.5, 'days').as('seconds'));
            // should have minted some credits
            let jobMintedCredits = (await keep3r.jobPeriodCredits(job.address))
                .mul(moment_1.default.duration(2.5, 'days').as('seconds') + 1)
                .div(rewardPeriodTime);
            let totalJobCredits = await keep3r.totalJobCredits(job.address);
            // using closeTo because of 1 second difference between views and expectation
            chai_1.expect(totalJobCredits).to.be.closeTo(jobMintedCredits, bn_1.toUnit(0.005).toNumber());
        });
        it('should generate the underlying tokens in an inflation period', async () => {
            const inflationPeriod = await keep3r.inflationPeriod();
            const expectedPeriodCredits = spentKp3rs.mul(rewardPeriodTime).div(inflationPeriod);
            chai_1.expect(await keep3r.jobPeriodCredits(job.address)).to.be.closeTo(expectedPeriodCredits, bn_1.toUnit(0.001).toNumber());
        });
        it('should max the total credits as long as the twap for all the liquidities stay the same', async () => {
            // wait 2 periods in order to have a stable twap & max amount of liquidity credits
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(10, 'days').as('seconds'));
            const maxedCredits = await keep3r.jobLiquidityCredits(job.address);
            // even if you wait more, if the twap doesn't change, the credits should stay the same
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(6, 'days').as('seconds'));
            chai_1.expect(await keep3r.jobLiquidityCredits(job.address)).to.equal(maxedCredits);
        });
        it('should lose half of the credits after unbonding half of the liquidity', async () => {
            // wait some days in order for that liquidity to generate credits
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(1, 'day').as('seconds'));
            const previousTotalJobCredits = await keep3r.totalJobCredits(job.address);
            // unbond half the liquidity and expect to have half the credits taken away
            await keep3r.connect(jobOwner).unbondLiquidityFromJob(job.address, pair.address, initialLiquidity.div(2));
            // using closeTo because of 1 second difference between views and expectation
            chai_1.expect(await keep3r.totalJobCredits(job.address)).to.be.closeTo(previousTotalJobCredits.div(2), bn_1.toUnit(0.005).toNumber());
        });
        it('should lose all of the credits after unbonding all of the liquidity', async () => {
            // wait some days in order for that liquidity to generate credits
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(4, 'days').as('seconds'));
            // withdraw all the liquidity and expect to have all the credits taken away
            await keep3r.connect(jobOwner).unbondLiquidityFromJob(job.address, pair.address, bn_1.toUnit(1));
            chai_1.expect(await keep3r.jobLiquidityCredits(job.address)).to.be.equal(0);
        });
        it('should update currentCredits and reset rewardedAt when more liquidity is added', async () => {
            // wait some days in order for that liquidity to generate credits
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(2, 'days').as('seconds'));
            const { liquidity } = await common.addLiquidityToPair(richGuy, pair, bn_1.toUnit(1), jobOwner);
            await pair.connect(jobOwner).approve(keep3r.address, liquidity);
            await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, liquidity);
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            chai_1.expect(await keep3r.jobLiquidityCredits(job.address)).to.be.equal(await keep3r.totalJobCredits(job.address));
            chai_1.expect(await keep3r.rewardedAt(job.address)).to.be.equal(blockTimestamp);
        });
        it('should reward jobLiquidityCredits and pay the keeper with them', async () => {
            let previousJobCredits;
            let previousTotalJobCredits;
            // wait some days in order for that liquidity to generate credits
            await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds'));
            previousJobCredits = await keep3r.jobLiquidityCredits(job.address);
            previousTotalJobCredits = await keep3r.totalJobCredits(job.address);
            await job.connect(keeper).work();
            chai_1.expect(await keep3r.jobLiquidityCredits(job.address)).to.be.gt(previousJobCredits);
            chai_1.expect((await keep3r.totalJobCredits(job.address)).sub((await keep3r.jobPeriodCredits(job.address)).div(rewardPeriodTime))).to.be.lt(previousTotalJobCredits);
        });
    });
    async function activateKeeper(keeper) {
        await keep3r.connect(keeper).bond(common.KP3R_V1_ADDRESS, 0);
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds'));
        await keep3r.connect(keeper).activate(common.KP3R_V1_ADDRESS);
    }
});
