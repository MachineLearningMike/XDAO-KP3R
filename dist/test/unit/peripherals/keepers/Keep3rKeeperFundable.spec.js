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
const bn_1 = require("@utils/bn");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rKeeperFundable', () => {
    let randomKeeper;
    let keeperFundable;
    let helper;
    let keep3rV1;
    let keeperFundableFactory;
    let keep3rV1Proxy;
    let erc20;
    let oraclePool;
    before(async () => {
        [, randomKeeper] = await hardhat_1.ethers.getSigners();
        keeperFundableFactory = await smock_1.smock.mock('Keep3rKeeperFundableForTest');
    });
    beforeEach(async () => {
        helper = await smock_1.smock.fake(IKeep3rHelper_json_1.default);
        erc20 = await smock_1.smock.fake(ERC20_json_1.default);
        keep3rV1 = await smock_1.smock.fake(IKeep3rV1_json_1.default);
        keep3rV1Proxy = await smock_1.smock.fake(IKeep3rV1Proxy_json_1.default);
        oraclePool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        oraclePool.token0.returns(keep3rV1.address);
        keeperFundable = await keeperFundableFactory.deploy(helper.address, keep3rV1.address, keep3rV1Proxy.address, oraclePool.address);
    });
    describe('bond', () => {
        beforeEach(async () => {
            erc20.transferFrom.returns(true);
        });
        it('should revert if keeper is disputed', async () => {
            await keeperFundable.setVariable('disputes', { [randomKeeper.address]: true });
            await chai_1.expect(keeperFundable.connect(randomKeeper).bond(erc20.address, bn_1.toUnit(1))).to.be.revertedWith('Disputed()');
        });
        it('should revert if caller is already a job', async () => {
            await keeperFundable.setJob(randomKeeper.address);
            await chai_1.expect(keeperFundable.connect(randomKeeper).bond(erc20.address, bn_1.toUnit(1))).to.be.revertedWith('AlreadyAJob()');
        });
        it('should emit event', async () => {
            const bondingAmount = bn_1.toUnit(1);
            erc20.balanceOf.returnsAtCall(0, bn_1.toUnit(0));
            erc20.balanceOf.returnsAtCall(1, bn_1.toUnit(1));
            await chai_1.expect(keeperFundable.connect(randomKeeper).bond(erc20.address, bondingAmount))
                .to.emit(keeperFundable, 'Bonding')
                .withArgs(randomKeeper.address, erc20.address, bondingAmount);
        });
    });
    describe('unbond', () => {
        const bondedAmount = bn_1.toUnit(1);
        beforeEach(async () => {
            await keeperFundable.setVariable('bonds', {
                [randomKeeper.address]: {
                    [erc20.address]: bondedAmount,
                    [keep3rV1.address]: bondedAmount,
                },
            });
        });
        it('should register the unblock timestamp', async () => {
            const unbondTime = await keeperFundable.callStatic.unbondTime();
            await keeperFundable.connect(randomKeeper).unbond(erc20.address, bn_1.toUnit(1));
            const unbondBlockTimestamp = (await hardhat_1.ethers.provider.getBlock('latest')).timestamp;
            const canWithdrawAfter = await keeperFundable.canWithdrawAfter(randomKeeper.address, erc20.address);
            chai_1.expect(canWithdrawAfter).to.equal(unbondTime.add(unbondBlockTimestamp));
        });
        it('should reduce amount from bonds', async () => {
            const toUnbondAmount = bn_1.toUnit(0.1);
            await keeperFundable.connect(randomKeeper).unbond(erc20.address, toUnbondAmount);
            const remaining = await keeperFundable.bonds(randomKeeper.address, erc20.address);
            chai_1.expect(remaining).to.equal(bondedAmount.sub(toUnbondAmount));
        });
        it('should add to the current pending unbond amount', async () => {
            const initialpendingUnbonds = bn_1.toUnit(2);
            const toUnbondAmount = bn_1.toUnit(1);
            await keeperFundable.setVariable('pendingUnbonds', {
                [randomKeeper.address]: {
                    [erc20.address]: initialpendingUnbonds,
                },
            });
            await keeperFundable.connect(randomKeeper).unbond(erc20.address, toUnbondAmount);
            const pendingUnbonds = await keeperFundable.pendingUnbonds(randomKeeper.address, erc20.address);
            chai_1.expect(pendingUnbonds).to.equal(initialpendingUnbonds.add(toUnbondAmount));
        });
        it('should emit event', async () => {
            const unbondingAmount = bn_1.toUnit(0.1);
            const tx = await keeperFundable.connect(randomKeeper).unbond(erc20.address, unbondingAmount);
            await chai_1.expect(tx).to.emit(keeperFundable, 'Unbonding').withArgs(randomKeeper.address, erc20.address, unbondingAmount);
        });
    });
    describe('activate', () => {
        it('should revert to a disputed keeper', async () => {
            await keeperFundable.setVariable('disputes', { [randomKeeper.address]: true });
            await chai_1.expect(keeperFundable.connect(randomKeeper).activate(erc20.address)).to.be.revertedWith('Disputed');
        });
        it('should revert if bondings are unexistent', async () => {
            await chai_1.expect(keeperFundable.connect(randomKeeper).activate(erc20.address)).to.be.revertedWith('BondsUnexistent');
        });
        it('should revert if bondings are blocked', async () => {
            const lastBlock = await hardhat_1.ethers.provider.getBlock('latest');
            await keeperFundable.setVariable('canActivateAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp + 10 } });
            await chai_1.expect(keeperFundable.connect(randomKeeper).activate(erc20.address)).to.be.revertedWith('BondsLocked');
        });
        context('when activating any ERC20', () => {
            beforeEach(async () => {
                const lastBlock = await hardhat_1.ethers.provider.getBlock('latest');
                await keeperFundable.setVariable('canActivateAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp } });
                await keeperFundable.setVariable('pendingBonds', { [randomKeeper.address]: { [erc20.address]: bn_1.toUnit(1) } });
            });
            it('should add the keeper', async () => {
                await keeperFundable.connect(randomKeeper).activate(erc20.address);
                chai_1.expect(await keeperFundable.isKeeper(randomKeeper.address)).to.be.true;
            });
            it('should reset pending bonds for that token', async () => {
                chai_1.expect(await keeperFundable.pendingBonds(randomKeeper.address, erc20.address)).to.be.eq(bn_1.toUnit(1));
                await keeperFundable.connect(randomKeeper).activate(erc20.address);
                chai_1.expect(await keeperFundable.pendingBonds(randomKeeper.address, erc20.address)).to.be.eq(0);
            });
            it('should add pending bonds to keeper accountance', async () => {
                chai_1.expect(await keeperFundable.bonds(randomKeeper.address, erc20.address)).to.be.eq(0);
                await keeperFundable.connect(randomKeeper).activate(erc20.address);
                chai_1.expect(await keeperFundable.bonds(randomKeeper.address, erc20.address)).to.be.eq(bn_1.toUnit(1));
            });
            it('should emit event', async () => {
                const tx = await keeperFundable.connect(randomKeeper).activate(erc20.address);
                await chai_1.expect(tx).to.emit(keeperFundable, 'Activation').withArgs(randomKeeper.address, erc20.address, bn_1.toUnit(1));
            });
        });
        context('when activating KP3R', () => {
            beforeEach(async () => {
                const lastBlock = await hardhat_1.ethers.provider.getBlock('latest');
                await keeperFundable.setVariable('canActivateAfter', { [randomKeeper.address]: { [keep3rV1.address]: lastBlock.timestamp } });
                await keeperFundable.setVariable('pendingBonds', { [randomKeeper.address]: { [keep3rV1.address]: bn_1.toUnit(1) } });
            });
            it('should burn bonded KP3Rs', async () => {
                await keeperFundable.connect(randomKeeper).activate(keep3rV1.address);
                chai_1.expect(keep3rV1.burn).to.have.been.calledWith(bn_1.toUnit(1));
            });
        });
    });
    describe('withdraw', () => {
        it('should revert if bondings are unexistent', async () => {
            await chai_1.expect(keeperFundable.connect(randomKeeper).withdraw(erc20.address)).to.be.revertedWith('UnbondsUnexistent');
        });
        it('should revert if bondings are blocked', async () => {
            const lastBlock = await hardhat_1.ethers.provider.getBlock('latest');
            await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp + 1000 } });
            await chai_1.expect(keeperFundable.connect(randomKeeper).withdraw(erc20.address)).to.be.revertedWith('UnbondsLocked');
        });
        it('should revert to a disputed keeper', async () => {
            const lastBlock = await hardhat_1.ethers.provider.getBlock('latest');
            await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp } });
            await keeperFundable.setVariable('disputes', { [randomKeeper.address]: true });
            await chai_1.expect(keeperFundable.connect(randomKeeper).withdraw(erc20.address)).to.be.revertedWith('Disputed');
        });
        context('when withdrawing any ERC20', () => {
            beforeEach(async () => {
                const lastBlock = await hardhat_1.ethers.provider.getBlock('latest');
                await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [erc20.address]: lastBlock.timestamp } });
                await keeperFundable.setVariable('pendingUnbonds', { [randomKeeper.address]: { [erc20.address]: bn_1.toUnit(1) } });
                erc20.transfer.returns(true);
            });
            it('should transfer the unbonded amount to the keeper', async () => {
                await keeperFundable.connect(randomKeeper).withdraw(erc20.address);
                chai_1.expect(erc20.transfer).to.have.been.calledWith(randomKeeper.address, bn_1.toUnit(1));
            });
            it('should reset the unbondigs', async () => {
                await keeperFundable.connect(randomKeeper).withdraw(erc20.address);
                chai_1.expect(await keeperFundable.pendingUnbonds(randomKeeper.address, erc20.address)).to.be.eq(0);
            });
            it('should emit event', async () => {
                const tx = await keeperFundable.connect(randomKeeper).withdraw(erc20.address);
                await chai_1.expect(tx).to.emit(keeperFundable, 'Withdrawal').withArgs(randomKeeper.address, erc20.address, bn_1.toUnit(1));
            });
        });
        context('when withdrawing KP3R', () => {
            beforeEach(async () => {
                const lastBlock = await hardhat_1.ethers.provider.getBlock('latest');
                await keeperFundable.setVariable('canWithdrawAfter', { [randomKeeper.address]: { [keep3rV1.address]: lastBlock.timestamp } });
                await keeperFundable.setVariable('pendingUnbonds', { [randomKeeper.address]: { [keep3rV1.address]: bn_1.toUnit(1) } });
                keep3rV1.transfer.returns(true);
            });
            it('should mint withdrawn KP3Rs', async () => {
                await keeperFundable.connect(randomKeeper).withdraw(keep3rV1.address);
                chai_1.expect(keep3rV1Proxy['mint(uint256)']).to.have.been.calledWith(bn_1.toUnit(1));
            });
        });
    });
});
