"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const smock_1 = require("@defi-wonderland/smock");
const _utils_1 = require("@utils");
const behaviours_1 = require("@utils/behaviours");
const constants_1 = require("@utils/constants");
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe('Keep3rJobOwnership', () => {
    const jobAddress = _utils_1.wallet.generateRandomAddress();
    let jobOwnership;
    let owner;
    let jobOwnershipFactory;
    before(async () => {
        [owner] = await hardhat_1.ethers.getSigners();
        jobOwnershipFactory = await smock_1.smock.mock('Keep3rJobOwnershipForTest');
    });
    beforeEach(async () => {
        jobOwnership = await jobOwnershipFactory.deploy();
        await jobOwnership.setVariable('jobOwner', {
            [jobAddress]: owner.address,
        });
    });
    describe('changeJobOwnership', () => {
        let notOwner;
        beforeEach(async () => {
            [, notOwner] = await hardhat_1.ethers.getSigners();
        });
        behaviours_1.onlyJobOwner(() => jobOwnership, 'changeJobOwnership', owner, () => [jobAddress, notOwner.address]);
        it('should set the new owner as pending', async () => {
            await jobOwnership.connect(owner).changeJobOwnership(jobAddress, notOwner.address);
            chai_1.expect(await jobOwnership.jobPendingOwner(jobAddress)).to.equal(notOwner.address);
        });
        it('should emit event', async () => {
            await chai_1.expect(jobOwnership.connect(owner).changeJobOwnership(jobAddress, notOwner.address))
                .to.emit(jobOwnership, 'JobOwnershipChange')
                .withArgs(jobAddress, owner.address, notOwner.address);
        });
    });
    describe('acceptJobOwnership', () => {
        let pendingOwner;
        let notPendingOwner;
        beforeEach(async () => {
            [, pendingOwner, notPendingOwner] = await hardhat_1.ethers.getSigners();
            await jobOwnership.setVariable('jobPendingOwner', {
                [jobAddress]: pendingOwner.address,
            });
        });
        it('should be callable by pending job owner', async () => {
            await chai_1.expect(jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress)).not.to.be.reverted;
        });
        it('should not be callable by any address', async () => {
            await chai_1.expect(jobOwnership.connect(notPendingOwner).acceptJobOwnership(jobAddress)).to.be.revertedWith('OnlyPendingJobOwner()');
        });
        it('should set the pending owner as the job owner', async () => {
            await jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress);
            chai_1.expect(await jobOwnership.jobOwner(jobAddress)).to.equal(pendingOwner.address);
        });
        it('should delete the job pending owner entry', async () => {
            await jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress);
            chai_1.expect(await jobOwnership.jobPendingOwner(jobAddress)).to.equal(constants_1.ZERO_ADDRESS);
        });
        it('should emit event', async () => {
            await chai_1.expect(jobOwnership.connect(pendingOwner).acceptJobOwnership(jobAddress))
                .to.emit(jobOwnership, 'JobOwnershipAssent')
                .withArgs(pendingOwner.address, jobAddress, owner.address);
        });
    });
});
