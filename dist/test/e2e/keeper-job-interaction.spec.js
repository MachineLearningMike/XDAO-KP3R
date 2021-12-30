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
const moment_1 = __importDefault(require("moment"));
const common = __importStar(require("./common"));
describe('@skip-on-coverage Keeper Job Interaction', () => {
    let jobOwner;
    let keep3r;
    let keep3rV1;
    let job;
    let governance;
    let keeper;
    let snapshotId;
    let pair;
    before(async () => {
        await _utils_1.evm.reset({
            jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
            blockNumber: common.FORK_BLOCK_NUMBER,
        });
        jobOwner = await _utils_1.wallet.impersonate(common.RICH_KP3R_ADDRESS);
        keeper = await _utils_1.wallet.impersonate(common.RICH_ETH_ADDRESS);
        ({ keep3r, governance, keep3rV1 } = await common.setupKeep3r());
        // create job
        job = await common.createJobForTest(keep3r.address, jobOwner);
        await keep3r.connect(governance).addJob(job.address);
        // create keeper
        await keep3r.connect(keeper).bond(keep3rV1.address, 0);
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(3, 'days').as('seconds'));
        await keep3r.connect(keeper).activate(keep3rV1.address);
        pair = await common.createLiquidityPair(governance);
        await keep3r.connect(governance).approveLiquidity(pair.address);
        snapshotId = await evm_1.snapshot.take();
    });
    beforeEach(async () => {
        await evm_1.snapshot.revert(snapshotId);
    });
    it('should not be able to work if there are no funds in job', async () => {
        await chai_1.expect(job.connect(keeper).work()).to.be.revertedWith('InsufficientFunds()');
    });
    it('should pay the keeper with bonds from job credits', async () => {
        // add liquidity to pair
        const { liquidity } = await common.addLiquidityToPair(jobOwner, pair, bn_1.toUnit(10), jobOwner);
        // add credit to job
        await pair.connect(jobOwner).approve(keep3r.address, liquidity);
        await keep3r.connect(jobOwner).addLiquidityToJob(job.address, pair.address, liquidity);
        // wait some time to mint credits
        await _utils_1.evm.advanceTimeAndBlock(moment_1.default.duration(5, 'days').as('seconds'));
        const keeperBondsBeforeWork = await keep3r.bonds(keeper._address, keep3rV1.address);
        const jobLiquidityCreditsBeforeWork = await keep3r.jobLiquidityCredits(job.address);
        // work as keeper
        await job.connect(keeper).work();
        const jobLiquidityCreditsAfterWork = await keep3r.jobLiquidityCredits(job.address);
        const keeperBondsAfterWork = await keep3r.bonds(keeper._address, keep3rV1.address);
        const liquidityCreditsSpent = jobLiquidityCreditsBeforeWork.sub(jobLiquidityCreditsAfterWork);
        const bondsEarned = keeperBondsAfterWork.sub(keeperBondsBeforeWork);
        chai_1.expect(liquidityCreditsSpent).to.be.gt(0);
        chai_1.expect(bondsEarned).to.be.gt(0);
        chai_1.expect(liquidityCreditsSpent).to.be.eq(bondsEarned);
    });
});
