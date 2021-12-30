"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const smock_1 = require("@defi-wonderland/smock");
const ERC20_json_1 = __importDefault(require("@openzeppelin/contracts/build/contracts/ERC20.json"));
const _utils_1 = require("@utils");
const chai_1 = require("chai");
const hardhat_1 = require("hardhat");
describe('UniV3PairManagerFactory', () => {
    //factories
    let uniV3PairManagerFactory;
    let pair;
    let token0;
    let token1;
    //contracts
    let uniPairFactory;
    //signers
    let deployer;
    before(async () => {
        [deployer] = await hardhat_1.ethers.getSigners();
        uniV3PairManagerFactory = await smock_1.smock.mock('UniV3PairManagerFactory');
        pair = await smock_1.smock.fake('UniV3PairManager');
        token0 = await smock_1.smock.fake(ERC20_json_1.default);
        token1 = await smock_1.smock.fake(ERC20_json_1.default);
        pair.token0.returns(token0.address);
        pair.token1.returns(token1.address);
        token0.symbol.returns('DAI');
        token1.symbol.returns('WETH');
    });
    beforeEach(async () => {
        uniPairFactory = await uniV3PairManagerFactory.deploy();
    });
    describe('constructor', () => {
        it('should set the governance to the deployer', async () => {
            chai_1.expect(await uniPairFactory.governance()).to.equal(deployer.address);
        });
    });
    describe('createPairManager', () => {
        it('should revert if the pair manager has already been initialized', async () => {
            const poolAddress = _utils_1.wallet.generateRandomAddress();
            await uniPairFactory.setVariable('pairManagers', {
                [poolAddress]: _utils_1.wallet.generateRandomAddress(),
            });
            await chai_1.expect(uniPairFactory.createPairManager(poolAddress)).to.be.revertedWith('AlreadyInitialized()');
        });
        context('when deployed', () => {
            let deployedAddress;
            beforeEach(async () => {
                deployedAddress = await uniPairFactory.callStatic.createPairManager(pair.address);
                await uniPairFactory.createPairManager(pair.address);
            });
            it('should deploy a new manager', async () => {
                const createdManager = (await hardhat_1.ethers.getContractAt('IUniV3PairManager', deployedAddress));
                chai_1.expect(await createdManager.callStatic.name()).to.equal('Keep3rLP - DAI/WETH');
            });
            it('should add the deployed manager to the mapping', async () => {
                chai_1.expect(await uniPairFactory.pairManagers(pair.address)).to.equal(deployedAddress);
            });
        });
        it('should emit an event when a manager is created', async () => {
            const deployedAddress = await uniPairFactory.callStatic.createPairManager(pair.address);
            await chai_1.expect(uniPairFactory.createPairManager(pair.address))
                .to.emit(uniPairFactory, 'PairCreated')
                .withArgs(pair.address, deployedAddress);
        });
    });
});
