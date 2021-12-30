"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const smock_1 = require("@defi-wonderland/smock");
const _utils_1 = require("@utils");
const bn_1 = require("@utils/bn");
const constants_1 = require("@utils/constants");
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe('Keep3rParameters', () => {
    let parameters;
    let governance;
    let parametersFactory;
    let keep3rHelper;
    const newOraclePool = _utils_1.wallet.generateRandomAddress();
    const oraclePool = _utils_1.wallet.generateRandomAddress();
    const keep3rV1 = _utils_1.wallet.generateRandomAddress();
    const keep3rV1Proxy = _utils_1.wallet.generateRandomAddress();
    const randomAddress = _utils_1.wallet.generateRandomAddress();
    before(async () => {
        [governance] = await hardhat_1.ethers.getSigners();
        parametersFactory = (await hardhat_1.ethers.getContractFactory('Keep3rParametersForTest'));
    });
    beforeEach(async () => {
        keep3rHelper = await smock_1.smock.fake('Keep3rHelper');
        parameters = await parametersFactory.deploy(keep3rHelper.address, keep3rV1, keep3rV1Proxy, oraclePool);
    });
    [
        { name: 'setKeep3rHelper', zero: true, parameter: 'keep3rHelper', args: () => [randomAddress], event: 'Keep3rHelperChange' },
        { name: 'setKeep3rV1', zero: true, parameter: 'keep3rV1', args: () => [randomAddress], event: 'Keep3rV1Change' },
        { name: 'setKeep3rV1Proxy', zero: true, parameter: 'keep3rV1Proxy', args: () => [randomAddress], event: 'Keep3rV1ProxyChange' },
        { name: 'setKp3rWethPool', zero: true, parameter: 'kp3rWethPool', args: () => [newOraclePool], event: 'Kp3rWethPoolChange' },
        { name: 'setBondTime', parameter: 'bondTime', args: () => [bn_1.toUnit(1)], event: 'BondTimeChange' },
        { name: 'setUnbondTime', parameter: 'unbondTime', args: () => [bn_1.toUnit(1)], event: 'UnbondTimeChange' },
        { name: 'setLiquidityMinimum', parameter: 'liquidityMinimum', args: () => [bn_1.toUnit(1)], event: 'LiquidityMinimumChange' },
        { name: 'setRewardPeriodTime', parameter: 'rewardPeriodTime', args: () => [bn_1.toUnit(1)], event: 'RewardPeriodTimeChange' },
        { name: 'setInflationPeriod', parameter: 'inflationPeriod', args: () => [bn_1.toUnit(1)], event: 'InflationPeriodChange' },
        { name: 'setFee', parameter: 'fee', args: () => [10], event: 'FeeChange' },
    ].forEach((method) => {
        describe(method.name, () => {
            _utils_1.behaviours.onlyGovernance(() => parameters, method.name, governance, method.args);
            if (method.zero) {
                it('should revert when sending zero address', async () => {
                    await chai_1.expect(parameters[method.name](constants_1.ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
                });
            }
            it('should assign specified value to variable', async () => {
                chai_1.expect(await parameters[method.parameter]()).not.to.be.equal(method.args()[0]);
                await parameters[method.name](...method.args());
                chai_1.expect(await parameters[method.parameter]()).to.be.equal(method.args()[0]);
            });
            it('should emit event', async () => {
                await chai_1.expect(parameters[method.name](...method.args()))
                    .to.emit(parameters, method.event)
                    .withArgs(...method.args());
            });
        });
    });
    describe('setKp3rWethPool', () => {
        it('should set the corresponding oracle pool', async () => {
            await parameters.setKp3rWethPool(newOraclePool);
            chai_1.expect(await parameters.viewLiquidityPool(newOraclePool)).to.be.eq(newOraclePool);
        });
        it('should set the order of KP3R in the pool', async () => {
            keep3rHelper.isKP3RToken0.returns(true);
            await parameters.setKp3rWethPool(newOraclePool);
            chai_1.expect(await parameters.viewIsKP3RToken0(newOraclePool)).to.be.true;
        });
    });
    describe('constructor', () => {
        it('should set keep3rHelper', async () => {
            chai_1.expect(await parameters.keep3rHelper()).to.be.equal(keep3rHelper.address);
        });
        it('should set keep3rV1', async () => {
            chai_1.expect(await parameters.keep3rV1()).to.be.equal(keep3rV1);
        });
        it('should set keep3rV1Proxy', async () => {
            chai_1.expect(await parameters.keep3rV1Proxy()).to.be.equal(keep3rV1Proxy);
        });
        it('should set kp3rWethPool', async () => {
            chai_1.expect(await parameters.kp3rWethPool()).to.be.equal(oraclePool);
        });
    });
});
