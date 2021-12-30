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
const bignumber_1 = require("@ethersproject/bignumber");
const ERC20_json_1 = __importDefault(require("@openzeppelin/contracts/build/contracts/ERC20.json"));
const IUniswapV3PoolForTest_json_1 = __importDefault(require("@solidity/for-test/IUniswapV3PoolForTest.sol/IUniswapV3PoolForTest.json"));
const bn_1 = require("@utils/bn");
const constants_1 = require("@utils/constants");
const chai_1 = __importStar(require("chai"));
const ethereum_waffle_1 = require("ethereum-waffle");
const utils_1 = require("ethers/lib/utils");
const hardhat_1 = require("hardhat");
chai_1.default.use(ethereum_waffle_1.solidity);
chai_1.default.use(smock_1.smock.matchers);
describe('UniV3PairManager', () => {
    //factories
    let uniV3PairManagerFactory;
    let fakeERC20Factory;
    //contracts
    let fakeERC20;
    //fake and mocks
    let uniV3PairManager;
    let uniswapPool;
    let token0;
    let token1;
    //signers
    let deployer;
    let newGovernance;
    let randomJobProvider;
    //misc
    let returnValues;
    let tenTokens = bn_1.toUnit(10);
    let TICK_LOWER = -887200;
    let TICK_UPPER = 887200;
    let liquidity;
    let amount0Min;
    let amount1Min;
    let tokensOwed0;
    let tokensOwed1;
    let amount0Desired;
    let amount1Desired;
    before(async () => {
        [deployer, newGovernance, randomJobProvider] = await hardhat_1.ethers.getSigners();
        uniV3PairManagerFactory = await smock_1.smock.mock('UniV3PairManagerForTest');
        fakeERC20Factory = (await hardhat_1.ethers.getContractFactory('ERC20ForTest'));
    });
    beforeEach(async () => {
        uniswapPool = await smock_1.smock.fake(IUniswapV3PoolForTest_json_1.default);
        token0 = await smock_1.smock.fake(ERC20_json_1.default);
        token1 = await smock_1.smock.fake(ERC20_json_1.default);
        uniswapPool.token0.returns(token0.address);
        uniswapPool.token1.returns(token1.address);
        token0.symbol.returns('DAI');
        token1.symbol.returns('WETH');
        uniV3PairManager = await uniV3PairManagerFactory.deploy(uniswapPool.address, deployer.address);
        fakeERC20 = await fakeERC20Factory.deploy('FAKE', 'FAKE', deployer.address, bn_1.toUnit(100));
        await fakeERC20.mint(uniV3PairManager.address, bn_1.toUnit(100));
    });
    describe('constructor', () => {
        it('should assign pool to the DAI-WETH pool', async () => {
            chai_1.expect(await uniV3PairManager.pool()).to.deep.equal(uniswapPool.address);
        });
        it('should assign fee to the DAI-WETH fee', async () => {
            chai_1.expect(await uniV3PairManager.fee()).to.deep.equal(await uniswapPool.fee());
        });
        it('should assign token0 to the DAI-WETH pool token0', async () => {
            chai_1.expect(await uniV3PairManager.token0()).to.deep.equal(await uniswapPool.token0());
        });
        it('should assign token0 to the DAI-WETH pool token1', async () => {
            chai_1.expect(await uniV3PairManager.token1()).to.deep.equal(await uniswapPool.token1());
        });
        it('should assign name to Keep3rLP - DAI/WETH', async () => {
            chai_1.expect(await uniV3PairManager.name()).to.deep.equal('Keep3rLP - DAI/WETH');
        });
        it('should assign symbol to kLP-DAI/WETH', async () => {
            chai_1.expect(await uniV3PairManager.symbol()).to.deep.equal('kLP-DAI/WETH');
        });
        it('should assign governance to deployer', async () => {
            chai_1.expect(await uniV3PairManager.governance()).to.equal(deployer.address);
        });
    });
    describe('uniswapV3MintCallback', () => {
        it('should revert if the caller is not the pool', async () => {
            const encodedStruct = hardhat_1.ethers.utils.defaultAbiCoder.encode(['address', 'address', 'uint24', 'address'], [await uniV3PairManager.token0(), await uniV3PairManager.token1(), await uniV3PairManager.fee(), deployer.address]);
            await chai_1.expect(uniV3PairManager.connect(deployer).uniswapV3MintCallback(10, 10, encodedStruct)).to.be.revertedWith('OnlyPool()');
        });
    });
    describe('position', () => {
        it('should call uniswap pool positions function with the correct arguments', async () => {
            await uniV3PairManager.position();
            chai_1.expect(uniswapPool.positions).to.be.calledOnceWith(utils_1.solidityKeccak256(['address', 'int24', 'int24'], [uniV3PairManager.address, TICK_LOWER, TICK_UPPER]));
        });
        it('should return the returning values of calling uniswap pool position function', async () => {
            returnValues = [1, 2, 3, 4, 5].map(bignumber_1.BigNumber.from);
            uniswapPool.positions.returns(returnValues);
            const values = await uniV3PairManager.position();
            chai_1.expect(values).to.deep.equal(returnValues);
        });
    });
    describe('collect', () => {
        it('should revert if the caller is not governance', async () => {
            await chai_1.expect(uniV3PairManager.connect(randomJobProvider).collect()).to.be.revertedWith('OnlyGovernance()');
        });
        it('should call collect with the correct arguments', async () => {
            tokensOwed0 = 4;
            tokensOwed1 = 5;
            uniswapPool.positions.returns([1, 2, 3, 4, 5].map(bignumber_1.BigNumber.from));
            await uniV3PairManager.collect();
            chai_1.expect(uniswapPool.collect).to.be.calledOnceWith(deployer.address, TICK_LOWER, TICK_UPPER, tokensOwed0, tokensOwed1);
        });
        it('should return the correct return values of the pool collect function', async () => {
            returnValues = [1, 2].map(bignumber_1.BigNumber.from);
            uniswapPool.collect.returns(returnValues);
            const values = await uniV3PairManager.callStatic.collect();
            chai_1.expect(values).to.deep.equal(returnValues);
        });
    });
    describe('burn', () => {
        it('should revert if caller does not have credits', async () => {
            amount0Min = 5;
            amount1Min = 5;
            uniswapPool.burn.returns([10, 20]);
            uniV3PairManager.burn.returns([10, 20]);
            await chai_1.expect(uniV3PairManager.connect(randomJobProvider).burn(liquidity, amount0Min, amount1Min, newGovernance.address)).to.be.reverted;
        });
        context('when the caller has credits', () => {
            beforeEach(async () => {
                liquidity = 10000;
                amount0Min = 5;
                amount1Min = 5;
                tokensOwed0 = 10;
                tokensOwed1 = 20;
                await uniV3PairManager.setVariable('balanceOf', {
                    [deployer.address]: tenTokens,
                });
                await uniV3PairManager.setVariable('totalSupply', tenTokens);
                uniswapPool.burn.returns([10, 20]);
                uniV3PairManager.burn.returns([10, 20]);
            });
            it('should call the pools burn function with the correct arguments', async () => {
                await uniV3PairManager.connect(deployer).burn(liquidity, amount0Min, amount1Min, newGovernance.address);
                chai_1.expect(uniswapPool.burn).to.be.calledOnceWith(TICK_LOWER, TICK_UPPER, liquidity);
            });
            it('should call the pools collect function with the correct arguments', async () => {
                await uniV3PairManager.connect(deployer).burn(liquidity, amount0Min, amount1Min, newGovernance.address);
                chai_1.expect(uniswapPool.collect).to.be.calledOnceWith(newGovernance.address, TICK_LOWER, TICK_UPPER, tokensOwed0, tokensOwed1);
            });
            it('should revert if burn returns less than amountMin', async () => {
                liquidity = 1;
                amount0Min = 20;
                amount1Min = 30;
                chai_1.expect(uniV3PairManager.burn(liquidity, amount0Min, amount1Min, deployer.address)).to.be.revertedWith('ExcessiveSlippage()');
            });
        });
    });
    describe('approve', () => {
        it('should increase the balance of the spender', async () => {
            await uniV3PairManager.connect(deployer).approve(newGovernance.address, tenTokens);
            chai_1.expect(await uniV3PairManager.allowance(deployer.address, newGovernance.address)).to.equal(tenTokens);
        });
        it('should emit an event if approve is successful', async () => {
            await chai_1.expect(await uniV3PairManager.connect(deployer).approve(newGovernance.address, tenTokens))
                .to.emit(uniV3PairManager, 'Approval')
                .withArgs(deployer.address, newGovernance.address, tenTokens);
        });
    });
    describe('transfer', () => {
        context('when user does not have credits and tries to transfer', () => {
            it('should revert', async () => {
                await chai_1.expect(uniV3PairManager.connect(deployer).transfer(newGovernance.address, tenTokens)).to.be.reverted;
            });
        });
        context('when user has credits', () => {
            beforeEach(async () => {
                await uniV3PairManager.setVariable('balanceOf', {
                    [deployer.address]: tenTokens,
                });
            });
            it('should transfer tokens from one account to another', async () => {
                await uniV3PairManager.connect(deployer).transfer(newGovernance.address, tenTokens);
                chai_1.expect(await uniV3PairManager.balanceOf(newGovernance.address)).to.deep.equal(tenTokens);
            });
            it('should emit an event when a transfer is successful', async () => {
                await chai_1.expect(uniV3PairManager.connect(deployer).transfer(newGovernance.address, tenTokens))
                    .to.emit(uniV3PairManager, 'Transfer')
                    .withArgs(deployer.address, newGovernance.address, tenTokens);
            });
        });
    });
    describe('transferFrom', () => {
        it('it should revert when the user does not have funds and has approved an spender', async () => {
            chai_1.expect(await uniV3PairManager.connect(deployer).approve(newGovernance.address, tenTokens));
            await chai_1.expect(uniV3PairManager.connect(newGovernance).transferFrom(deployer.address, newGovernance.address, tenTokens)).to.be.reverted;
        });
        context('when user has funds and has approved an spender', () => {
            beforeEach(async () => {
                await uniV3PairManager.setVariable('balanceOf', {
                    [deployer.address]: tenTokens,
                });
                await uniV3PairManager.connect(deployer).approve(newGovernance.address, tenTokens);
            });
            it('should transfer tokens from one account to another', async () => {
                await uniV3PairManager.connect(newGovernance).transferFrom(deployer.address, newGovernance.address, tenTokens);
                chai_1.expect(await uniV3PairManager.balanceOf(newGovernance.address)).to.deep.equal(tenTokens);
            });
            it('should emit an event when a transfer is successful', async () => {
                await chai_1.expect(await uniV3PairManager.connect(newGovernance).transferFrom(deployer.address, newGovernance.address, tenTokens))
                    .to.emit(uniV3PairManager, 'Transfer')
                    .withArgs(deployer.address, newGovernance.address, tenTokens);
            });
            it('should reduce the spenders allowance after a transferFrom', async () => {
                await uniV3PairManager.connect(newGovernance).transferFrom(deployer.address, newGovernance.address, tenTokens);
                chai_1.expect(await uniV3PairManager.allowance(deployer.address, newGovernance.address)).to.deep.equal(0);
            });
            it('should emit an event when the allowance is changed', async () => {
                await chai_1.expect(await uniV3PairManager.connect(newGovernance).transferFrom(deployer.address, newGovernance.address, tenTokens))
                    .to.emit(uniV3PairManager, 'Approval')
                    .withArgs(deployer.address, newGovernance.address, 0);
            });
        });
    });
    describe('_addLiquidity', () => {
        ///@notice for the purpose of testing internal functions, they've been made external in the for-test contract
        ///        and given the name: internal + [original internal function name] for clarity.
        //         Example: internalAddLiquidity
        amount0Desired = 10;
        amount1Desired = 20;
        amount0Min = 30;
        amount1Min = 40;
        it('should revert if the pools mint function return values are not set', async () => {
            await chai_1.expect(uniV3PairManager.connect(deployer).internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min)).to.be.revertedWith('ExcessiveSlippage()');
        });
        context('when the pools mint function return values are set', () => {
            beforeEach(async () => {
                returnValues = [100, 200].map(bignumber_1.BigNumber.from);
                uniswapPool.mint.returns(returnValues);
            });
            it('should return the right return values of the pools mint function', async () => {
                const encodedStruct = hardhat_1.ethers.utils.defaultAbiCoder.encode(['address', 'address', 'uint24', 'address'], [await uniV3PairManager.token0(), await uniV3PairManager.token1(), await uniV3PairManager.fee(), deployer.address]);
                await uniV3PairManager.connect(deployer).internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min);
                chai_1.expect(uniswapPool.mint).to.have.been.calledOnceWith(uniV3PairManager.address, TICK_LOWER, TICK_UPPER, bignumber_1.BigNumber.from(0), encodedStruct);
            });
            it('should call pool slot0', async () => {
                await uniV3PairManager.internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min);
                chai_1.expect(uniswapPool.slot0).to.have.been.calledOnce;
            });
            it('should revert if amountOut is lower than amountMin', async () => {
                amount0Min = 300;
                amount1Min = 400;
                await chai_1.expect(uniV3PairManager.internalAddLiquidity(amount0Desired, amount1Desired, amount0Min, amount1Min)).to.be.revertedWith('ExcessiveSlippage()');
            });
        });
    });
    describe('_mint', () => {
        it('should mint credits to the recipient', async () => {
            await uniV3PairManager.internalMint(newGovernance.address, tenTokens);
            chai_1.expect(await uniV3PairManager.balanceOf(newGovernance.address)).to.equal(tenTokens);
        });
        it('should increase the contracts totalSupply', async () => {
            await uniV3PairManager.internalMint(newGovernance.address, tenTokens);
            chai_1.expect(await uniV3PairManager.totalSupply()).to.equal(tenTokens);
        });
        it('should emit an event if the credits have been minted successfuly', async () => {
            await chai_1.expect(await uniV3PairManager.internalMint(newGovernance.address, tenTokens))
                .to.emit(uniV3PairManager, 'Transfer')
                .withArgs(constants_1.ZERO_ADDRESS, newGovernance.address, tenTokens);
        });
    });
    describe('_burn', () => {
        it('should revert if the user does not have credits in his balance and tries to burn', async () => {
            const smallTokenAmount = 1;
            await chai_1.expect(uniV3PairManager.internalBurn(deployer.address, smallTokenAmount)).to.be.reverted;
        });
        context('when user has credits in his balance', () => {
            beforeEach(async () => {
                await uniV3PairManager.setVariable('totalSupply', tenTokens);
                await uniV3PairManager.setVariable('balanceOf', {
                    [deployer.address]: tenTokens,
                });
            });
            it('should burn credits to the recipient', async () => {
                await uniV3PairManager.internalBurn(deployer.address, tenTokens);
                chai_1.expect(await uniV3PairManager.balanceOf(deployer.address)).to.equal(0);
            });
            it('should reduce the total supply after burning credits', async () => {
                await uniV3PairManager.internalBurn(deployer.address, tenTokens);
                chai_1.expect(await uniV3PairManager.totalSupply()).to.equal(0);
            });
            it('should emit an event if the credits have been burned successfuly', async () => {
                await chai_1.expect(await uniV3PairManager.internalBurn(deployer.address, tenTokens))
                    .to.emit(uniV3PairManager, 'Transfer')
                    .withArgs(deployer.address, constants_1.ZERO_ADDRESS, tenTokens);
            });
        });
    });
    describe('_pay', () => {
        it('should transfer tokens to the recipient', async () => {
            fakeERC20.connect(deployer).approve(uniV3PairManager.address, tenTokens);
            await uniV3PairManager.internalPay(fakeERC20.address, deployer.address, newGovernance.address, tenTokens);
            chai_1.expect(await fakeERC20.balanceOf(newGovernance.address)).to.equal(tenTokens);
        });
        it('should fail if payer did not approve the contract to spend his tokens', async () => {
            await chai_1.expect(uniV3PairManager.internalPay(fakeERC20.address, deployer.address, newGovernance.address, tenTokens)).to.be.revertedWith('UnsuccessfulTransfer()');
        });
    });
});
