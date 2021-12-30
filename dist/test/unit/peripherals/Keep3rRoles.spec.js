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
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('Keep3rRoles', () => {
    let roles;
    let governance;
    let rolesFactory;
    const randomAddress = _utils_1.wallet.generateRandomAddress();
    before(async () => {
        rolesFactory = await smock_1.smock.mock('Keep3rRoles');
        [, governance] = await hardhat_1.ethers.getSigners();
    });
    beforeEach(async () => {
        roles = await rolesFactory.deploy(governance.address);
    });
    describe('addSlasher', () => {
        _utils_1.behaviours.onlyGovernance(() => roles, 'addSlasher', governance, [randomAddress]);
        it('should revert if slasher already added', async () => {
            await roles.setVariable('slashers', { [randomAddress]: true });
            await chai_1.expect(roles.connect(governance).addSlasher(randomAddress)).to.be.revertedWith('SlasherExistent()');
        });
        it('should add the slasher', async () => {
            await roles.connect(governance).addSlasher(randomAddress);
            chai_1.expect(await roles.slashers(randomAddress)).to.be.true;
        });
        it('should emit event', async () => {
            const tx = await roles.connect(governance).addSlasher(randomAddress);
            await chai_1.expect(tx).to.emit(roles, 'SlasherAdded').withArgs(randomAddress);
        });
    });
    describe('removeSlasher', () => {
        _utils_1.behaviours.onlyGovernance(() => roles, 'removeSlasher', governance, [randomAddress]);
        it('should revert if slasher not added', async () => {
            await chai_1.expect(roles.connect(governance).removeSlasher(randomAddress)).to.be.revertedWith('SlasherUnexistent()');
        });
        it('should remove the slasher', async () => {
            await roles.setVariable('slashers', { [randomAddress]: true });
            await roles.connect(governance).removeSlasher(randomAddress);
            chai_1.expect(await roles.slashers(randomAddress)).to.be.false;
        });
        it('should emit event', async () => {
            await roles.setVariable('slashers', { [randomAddress]: true });
            const tx = await roles.connect(governance).removeSlasher(randomAddress);
            await chai_1.expect(tx).to.emit(roles, 'SlasherRemoved').withArgs(randomAddress);
        });
    });
    describe('addDisputer', () => {
        _utils_1.behaviours.onlyGovernance(() => roles, 'addDisputer', governance, [randomAddress]);
        it('should revert if disputer already added', async () => {
            await roles.setVariable('disputers', { [randomAddress]: true });
            await chai_1.expect(roles.connect(governance).addDisputer(randomAddress)).to.be.revertedWith('DisputerExistent()');
        });
        it('should add the disputer', async () => {
            await roles.connect(governance).addDisputer(randomAddress);
            chai_1.expect(await roles.disputers(randomAddress)).to.be.true;
        });
        it('should emit event', async () => {
            const tx = await roles.connect(governance).addDisputer(randomAddress);
            await chai_1.expect(tx).to.emit(roles, 'DisputerAdded').withArgs(randomAddress);
        });
    });
    describe('removeDisputer', () => {
        _utils_1.behaviours.onlyGovernance(() => roles, 'removeDisputer', governance, [randomAddress]);
        it('should revert if disputer not added', async () => {
            await chai_1.expect(roles.connect(governance).removeSlasher(randomAddress)).to.be.revertedWith('SlasherUnexistent()');
        });
        it('should remove the disputer', async () => {
            await roles.setVariable('disputers', { [randomAddress]: true });
            await roles.connect(governance).removeDisputer(randomAddress);
            chai_1.expect(await roles.slashers(randomAddress)).to.be.false;
        });
        it('should emit event', async () => {
            await roles.setVariable('disputers', { [randomAddress]: true });
            const tx = await roles.connect(governance).removeDisputer(randomAddress);
            await chai_1.expect(tx).to.emit(roles, 'DisputerRemoved').withArgs(randomAddress);
        });
    });
});
