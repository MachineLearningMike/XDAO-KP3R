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
Object.defineProperty(exports, "__esModule", { value: true });
const smock_1 = require("@defi-wonderland/smock");
const _utils_1 = require("@utils");
const behaviours_1 = require("@utils/behaviours");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rDisputable', () => {
    const job = _utils_1.wallet.generateRandomAddress();
    let disputer;
    let disputable;
    let disputableFactory;
    before(async () => {
        [, disputer] = await hardhat_1.ethers.getSigners();
        disputableFactory = await smock_1.smock.mock('Keep3rDisputableForTest');
    });
    beforeEach(async () => {
        disputable = await disputableFactory.deploy();
        await disputable.setVariable('disputers', { [disputer.address]: true });
    });
    describe('dispute', () => {
        behaviours_1.onlyDisputer(() => disputable, 'dispute', () => [disputer], [job]);
        it('should revert if job was already disputed', async () => {
            await disputable.connect(disputer).dispute(job);
            await chai_1.expect(disputable.connect(disputer).dispute(job)).to.be.revertedWith('AlreadyDisputed()');
        });
        it('should create a job dispute', async () => {
            await disputable.connect(disputer).dispute(job);
            chai_1.expect(await disputable.connect(disputer).disputes(job)).to.be.true;
        });
        it('should emit event', async () => {
            await chai_1.expect(disputable.connect(disputer).dispute(job)).to.emit(disputable, 'Dispute').withArgs(job, disputer.address);
        });
    });
    describe('resolve', () => {
        behaviours_1.onlyDisputer(() => disputable, 'resolve', () => [disputer], [job]);
        it('should revert if job was not disputed', async () => {
            await chai_1.expect(disputable.connect(disputer).resolve(job)).to.be.revertedWith('NotDisputed()');
        });
        context('when job is disputed', () => {
            beforeEach(async () => {
                await disputable.setVariable('disputes', { [job]: true });
            });
            it('should resolve job dispute', async () => {
                await disputable.connect(disputer).resolve(job);
                chai_1.expect(await disputable.connect(disputer).disputes(job)).to.be.false;
            });
            it('should emit event', async () => {
                await chai_1.expect(disputable.connect(disputer).resolve(job)).to.emit(disputable, 'Resolve').withArgs(job, disputer.address);
            });
        });
    });
});
