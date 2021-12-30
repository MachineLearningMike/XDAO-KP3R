"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _utils_1 = require("@utils");
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe('Keep3rAccountance', () => {
    let accountance;
    let accountanceFactory;
    const randomAddr1 = _utils_1.wallet.generateRandomAddress();
    const randomAddr2 = _utils_1.wallet.generateRandomAddress();
    before(async () => {
        accountanceFactory = (await hardhat_1.ethers.getContractFactory('Keep3rAccountanceForTest'));
    });
    beforeEach(async () => {
        accountance = await accountanceFactory.deploy();
    });
    describe('jobs', () => {
        it('should return full list', async () => {
            accountance.setJob(randomAddr1);
            accountance.setJob(randomAddr2);
            chai_1.expect(await accountance.jobs()).to.deep.equal([randomAddr1, randomAddr2]);
        });
        it('should not store duplicates', async () => {
            accountance.setJob(randomAddr1);
            accountance.setJob(randomAddr2);
            accountance.setJob(randomAddr2);
            chai_1.expect(await accountance.jobs()).to.deep.equal([randomAddr1, randomAddr2]);
        });
    });
    describe('keepers', () => {
        it('should return full list', async () => {
            accountance.setKeeper(randomAddr1);
            accountance.setKeeper(randomAddr2);
            chai_1.expect(await accountance.keepers()).to.deep.equal([randomAddr1, randomAddr2]);
        });
        it('should not store duplicates', async () => {
            accountance.setKeeper(randomAddr1);
            accountance.setKeeper(randomAddr2);
            accountance.setKeeper(randomAddr2);
            chai_1.expect(await accountance.keepers()).to.deep.equal([randomAddr1, randomAddr2]);
        });
    });
});
