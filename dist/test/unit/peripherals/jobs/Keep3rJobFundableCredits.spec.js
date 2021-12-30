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
const behaviours_1 = require("@utils/behaviours");
const bn_1 = require("@utils/bn");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rJobFundableCredits', () => {
    const approvedJob = _utils_1.wallet.generateRandomAddress();
    const randomJob = _utils_1.wallet.generateRandomAddress();
    let governance;
    let provider;
    let jobOwner;
    let jobFundable;
    let keep3rV1;
    let keep3rV1Proxy;
    let helper;
    let oraclePool;
    let jobFundableFactory;
    before(async () => {
        [governance, provider, jobOwner] = await hardhat_1.ethers.getSigners();
        jobFundableFactory = await smock_1.smock.mock('Keep3rJobFundableCreditsForTest');
    });
    beforeEach(async () => {
        helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        oraclePool.token0.returns(keep3rV1.address);
        jobFundable = await jobFundableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
        await jobFundable.setJob(approvedJob, jobOwner.address);
    });
    describe('addTokenCreditsToJob', () => {
        let token;
        let erc20Factory;
        before(async () => {
            erc20Factory = (await hardhat_1.ethers.getContractFactory('ERC20ForTest'));
        });
        beforeEach(async () => {
            token = await erc20Factory.deploy('Sample', 'SMP', provider.address, bn_1.toUnit(10));
            await token.connect(provider).approve(jobFundable.address, bn_1.toUnit(10));
        });
        it('should revert when called with unallowed job', async () => {
            await chai_1.expect(jobFundable.connect(provider).addTokenCreditsToJob(randomJob, token.address, bn_1.toUnit(1))).to.be.revertedWith('JobUnavailable()');
        });
        it('should revert when when token is KP3R', async () => {
            await chai_1.expect(jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, keep3rV1.address, bn_1.toUnit(1))).to.be.revertedWith('TokenUnallowed()');
        });
        it('should revert if transfer fails', async () => {
            await chai_1.expect(jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, bn_1.toUnit(11))).to.be.revertedWith('ERC20: transfer amount exceeds balance');
        });
        it('should increase job token credits, after fees', async () => {
            await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, bn_1.toUnit(1));
            chai_1.expect(await jobFundable.jobTokenCredits(approvedJob, token.address)).to.equal(bn_1.toUnit(0.997));
        });
        it('should transfer tokens to contract', async () => {
            await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, bn_1.toUnit(1));
            chai_1.expect(await token.balanceOf(jobFundable.address)).to.equal(bn_1.toUnit(0.997));
        });
        it('should save the block timestamp of when the credits were added', async () => {
            await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, bn_1.toUnit(1));
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            chai_1.expect(await jobFundable.jobTokenCreditsAddedAt(approvedJob, token.address)).to.equal(blockTimestamp);
        });
        it('should transfer fee in tokens to governance', async () => {
            await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, bn_1.toUnit(1));
            chai_1.expect(await token.balanceOf(governance.address)).to.equal(bn_1.toUnit(0.003));
        });
        it('should emit event', async () => {
            await chai_1.expect(jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, bn_1.toUnit(1)))
                .to.emit(jobFundable, 'TokenCreditAddition')
                .withArgs(approvedJob, token.address, provider.address, bn_1.toUnit(1));
        });
        it('should add token address to the job token list', async () => {
            await jobFundable.connect(provider).addTokenCreditsToJob(approvedJob, token.address, bn_1.toUnit(1));
            chai_1.expect(await jobFundable.isJobToken(approvedJob, token.address)).to.be.true;
        });
    });
    describe('withdrawTokenCreditsFromJob', () => {
        let token;
        beforeEach(async () => {
            token = await smock_1.smock.fake(ERC20_json_1.default);
            token.transfer.returns(true);
            await jobFundable.setVariable('jobTokenCredits', {
                [approvedJob]: {
                    [token.address]: bn_1.toUnit(1),
                },
            });
        });
        behaviours_1.onlyJobOwner(() => jobFundable, 'withdrawTokenCreditsFromJob', jobOwner, () => [approvedJob, token.address, bn_1.toUnit(1), provider.address]);
        it('should revert if credits were deposited in the less than 60 seconds ago', async () => {
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobFundable.setVariable('jobTokenCreditsAddedAt', {
                [approvedJob]: {
                    [token.address]: blockTimestamp,
                },
            });
            await _utils_1.evm.advanceToTime(blockTimestamp + 60);
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(1), provider.address)).to.be.revertedWith('JobTokenCreditsLocked()');
        });
        it('should revert if the job is disputed', async () => {
            await jobFundable.setVariable('disputes', {
                [approvedJob]: true,
            });
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(1), provider.address)).to.be.revertedWith('JobDisputed()');
        });
        it('should not revert if credits were deposited 60 seconds ago', async () => {
            const blockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            await jobFundable.setVariable('jobTokenCreditsAddedAt', {
                [approvedJob]: {
                    [token.address]: blockTimestamp,
                },
            });
            await _utils_1.evm.advanceToTime(blockTimestamp + 61);
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(1), provider.address)).not.to.be.revertedWith('JobTokenCreditsLocked()');
        });
        it('should revert if transfer fails', async () => {
            token.transfer.returns(false);
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(1), provider.address)).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
        });
        it('should revert if job does not have enough credits', async () => {
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(2), provider.address)).to.be.revertedWith('InsufficientJobTokenCredits()');
        });
        it('should reduce the amount withdrawn from job balance', async () => {
            await jobFundable.setVariable('jobTokenCreditsAddedAt', {
                [approvedJob]: {
                    [token.address]: 0,
                },
            });
            await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(0.4), provider.address);
            chai_1.expect(await jobFundable.jobTokenCredits(approvedJob, token.address)).to.equal(bn_1.toUnit(0.6));
        });
        it('should transfer tokens to specified receiver', async () => {
            await jobFundable.setVariable('jobTokenCreditsAddedAt', {
                [approvedJob]: {
                    [token.address]: 0,
                },
            });
            await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(1), provider.address);
            chai_1.expect(token.transfer).to.be.calledOnceWith(provider.address, bn_1.toUnit(1));
        });
        it('should emit event', async () => {
            await jobFundable.setVariable('jobTokenCreditsAddedAt', {
                [approvedJob]: {
                    [token.address]: 0,
                },
            });
            await chai_1.expect(jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(0.4), provider.address))
                .to.emit(jobFundable, 'TokenCreditWithdrawal')
                .withArgs(approvedJob, token.address, provider.address, bn_1.toUnit(0.4));
        });
        it('should not remove token from the job token list when partially withdrawn', async () => {
            await jobFundable.setVariable('jobTokenCreditsAddedAt', {
                [approvedJob]: {
                    [token.address]: 0,
                },
            });
            await jobFundable.setJobToken(approvedJob, token.address);
            await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(0.4), provider.address);
            chai_1.expect(await jobFundable.isJobToken(approvedJob, token.address)).to.be.true;
        });
        it('should remove token from the job token list when fully withdrawn', async () => {
            await jobFundable.setVariable('jobTokenCreditsAddedAt', {
                [approvedJob]: {
                    [token.address]: 0,
                },
            });
            await jobFundable.setJobToken(approvedJob, token.address);
            await jobFundable.connect(jobOwner).withdrawTokenCreditsFromJob(approvedJob, token.address, bn_1.toUnit(1), provider.address);
            chai_1.expect(await jobFundable.isJobToken(approvedJob, token.address)).to.be.false;
        });
    });
});
