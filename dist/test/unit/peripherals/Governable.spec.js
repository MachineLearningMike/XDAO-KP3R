"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const smock_1 = require("@defi-wonderland/smock");
const _utils_1 = require("@utils");
const constants_1 = require("@utils/constants");
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe('Governable', () => {
    let governance;
    let pendingGovernance;
    let governableFactory;
    const randomAddress = _utils_1.wallet.generateRandomAddress();
    before(async () => {
        [, governance, pendingGovernance] = await hardhat_1.ethers.getSigners();
        governableFactory = await smock_1.smock.mock('GovernableForTest');
    });
    describe('constructor', () => {
        it('should revert when given zero address', async () => {
            await chai_1.expect(governableFactory.deploy(constants_1.ZERO_ADDRESS)).to.be.revertedWith('NoGovernanceZeroAddress()');
        });
    });
    context('after deployed', () => {
        let governable;
        beforeEach(async () => {
            governable = await governableFactory.deploy(governance.address);
        });
        describe('setGovernance', () => {
            _utils_1.behaviours.onlyGovernance(() => governable, 'setGovernance', governance, [randomAddress]);
            it('should set pendingGovernance', async () => {
                await governable.connect(governance).setGovernance(randomAddress);
                chai_1.expect(await governable.pendingGovernance()).to.be.eq(randomAddress);
            });
            it('should emit event', async () => {
                const tx = await governable.connect(governance).setGovernance(randomAddress);
                await chai_1.expect(tx).to.emit(governable, 'GovernanceProposal').withArgs(randomAddress);
            });
        });
        describe('acceptGovernance', () => {
            beforeEach(async () => {
                await governable.setVariable('pendingGovernance', pendingGovernance.address);
            });
            _utils_1.behaviours.onlyPendingGovernance(() => governable, 'acceptGovernance', pendingGovernance, []);
            it('should set governance', async () => {
                await governable.connect(pendingGovernance).acceptGovernance();
                chai_1.expect(await governable.governance()).to.be.eq(pendingGovernance.address);
            });
            it('should remove pending governance', async () => {
                await governable.connect(pendingGovernance).acceptGovernance();
                chai_1.expect(await governable.pendingGovernance()).to.be.eq(constants_1.ZERO_ADDRESS);
            });
            it('should emit event', async () => {
                const tx = await governable.connect(pendingGovernance).acceptGovernance();
                await chai_1.expect(tx).to.emit(governable, 'GovernanceSet').withArgs(pendingGovernance.address);
            });
        });
    });
});
