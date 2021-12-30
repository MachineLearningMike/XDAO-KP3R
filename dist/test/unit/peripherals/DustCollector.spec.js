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
const bn_1 = require("@utils/bn");
const constants_1 = require("@utils/constants");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
chai_1.default.use(smock_1.smock.matchers);
describe('DustCollectorForTest', () => {
    let dust;
    let dustFactory;
    let governance;
    let fakeERC20;
    let randomAddress = _utils_1.wallet.generateRandomAddress();
    let oneEth = bn_1.toUnit(1);
    let tenTokens = bn_1.toUnit(10);
    before(async () => {
        [, governance] = await hardhat_1.ethers.getSigners();
        dustFactory = await smock_1.smock.mock('DustCollectorForTest');
    });
    beforeEach(async () => {
        dust = await dustFactory.connect(governance).deploy();
        fakeERC20 = await smock_1.smock.fake('IERC20');
        await _utils_1.contracts.setBalance(dust.address, tenTokens);
    });
    describe('sendDust', () => {
        behaviours_1.onlyGovernance(() => dust, 'sendDust', governance, () => [fakeERC20.address, tenTokens, randomAddress]);
        it('should revert if the receiver is the zero address', async () => {
            await chai_1.expect(dust.sendDust(constants_1.ETH_ADDRESS, oneEth, constants_1.ZERO_ADDRESS)).to.be.revertedWith('ZeroAddress()');
        });
        it('should revert if the address is neither an ERC20 nor ETH', async () => {
            await chai_1.expect(dust.sendDust(dust.address, oneEth, randomAddress)).to.be.revertedWith('SafeERC20: low-level call failed');
        });
        it('should revert if transfer fails', async () => {
            await chai_1.expect(dust.sendDust(fakeERC20.address, tenTokens, randomAddress)).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed');
        });
        context('when the function is called with the correct parameters', () => {
            let ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
            let randomUser;
            before(async () => {
                randomUser = await _utils_1.wallet.generateRandom();
            });
            it('should transfer ETH successfully', async () => {
                await dust.sendDust(ETH_ADDRESS, oneEth, randomUser.address);
                chai_1.expect(await randomUser.getBalance()).to.equal(oneEth);
            });
            it('should emit an event if the transfer is successful', async () => {
                let ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
                await chai_1.expect(dust.sendDust(ETH_ADDRESS, oneEth, randomAddress)).to.emit(dust, 'DustSent').withArgs(ETH_ADDRESS, oneEth, randomAddress);
            });
            it('should call the transfer with the correct arguments', async () => {
                fakeERC20.transfer.returns(true);
                await dust.sendDust(fakeERC20.address, tenTokens, randomAddress);
                chai_1.expect(fakeERC20.transfer).to.have.been.calledWith(randomAddress, tenTokens);
            });
        });
    });
});
