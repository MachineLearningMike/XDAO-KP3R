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
const bn_1 = require("@utils/bn");
const chai_1 = __importStar(require("chai"));
const hardhat_1 = require("hardhat");
const common = __importStar(require("./common"));
chai_1.default.use(smock_1.smock.matchers);
const DAI_WETH_POOL = '0x60594a405d53811d3BC4766596EFD80fd545A270';
const DAI_WETH_WHALE = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0';
const UNIV3_ROUTER_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
describe('UniV3PairManager', () => {
    //factories
    let uniV3PairManagerFactory;
    //contracts
    let uniV3PairManager;
    let uniswapPool;
    let liquidityAmounts;
    let liquidityAmountsFactory;
    let uniRouter;
    //tokens
    let dai;
    let weth;
    //signers
    let governance;
    let deployer;
    let whale;
    //misc
    let liquidity;
    let tenTokens = bn_1.toUnit(10);
    let twentyTokens = bn_1.toUnit(20);
    let amount0MinIsZero = 0;
    let amount1MinIsZero = 0;
    before(async () => {
        [deployer, governance] = await hardhat_1.ethers.getSigners();
        dai = (await hardhat_1.ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.DAI_ADDRESS));
        weth = (await hardhat_1.ethers.getContractAt('@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20', common.WETH_ADDRESS));
        uniswapPool = (await hardhat_1.ethers.getContractAt('IUniswapV3Pool', DAI_WETH_POOL));
        uniRouter = (await hardhat_1.ethers.getContractAt('ISwapRouter', UNIV3_ROUTER_ADDRESS));
        uniV3PairManagerFactory = (await hardhat_1.ethers.getContractFactory('UniV3PairManager'));
        liquidityAmountsFactory = (await hardhat_1.ethers.getContractFactory('LiquidityAmountsForTest'));
    });
    beforeEach(async () => {
        await _utils_1.evm.reset({
            jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
            blockNumber: common.FORK_BLOCK_NUMBER,
        });
        uniV3PairManager = await uniV3PairManagerFactory.deploy(DAI_WETH_POOL, deployer.address);
        liquidityAmounts = await liquidityAmountsFactory.deploy();
        whale = await _utils_1.wallet.impersonate(DAI_WETH_WHALE);
        //mint approvals
        await dai.connect(whale).approve(uniV3PairManager.address, twentyTokens);
        await weth.connect(whale).approve(uniV3PairManager.address, twentyTokens);
        //swap approvals
        await dai.connect(whale).approve(uniRouter.address, tenTokens);
        await weth.connect(whale).approve(uniRouter.address, tenTokens);
        //set governance to governance
        await uniV3PairManager.setGovernance(governance.address);
        await uniV3PairManager.connect(governance).acceptGovernance();
    });
    async function calculateLiquidity(token0, token1) {
        const sqrtPriceX96 = (await uniswapPool.slot0()).sqrtPriceX96;
        const sqrtRatioAX96 = await uniV3PairManager.sqrtRatioAX96();
        const sqrtRatioBX96 = await uniV3PairManager.sqrtRatioBX96();
        const liquidity = await liquidityAmounts.getLiquidityForAmounts(sqrtPriceX96, sqrtRatioAX96, sqrtRatioBX96, token0, token1);
        return liquidity;
    }
    describe('mint', () => {
        it('should increase the DAI/WETH position of the contract if the user provides liquidity', async () => {
            liquidity = await calculateLiquidity(tenTokens, tenTokens);
            await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
            chai_1.expect((await uniV3PairManager.position()).liquidity).to.eq(liquidity);
        });
        it('should mint credit to the user', async () => {
            liquidity = await calculateLiquidity(tenTokens, tenTokens);
            await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
            chai_1.expect(await uniV3PairManager.balanceOf(whale._address)).to.eq(liquidity);
        });
    });
    //helper function to reduce shared setup by collect() and burn()
    async function provideLiquidityAndSwap() {
        await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
        //simulates swap in uniswap pool
        await uniRouter.connect(whale).exactInputSingle({
            tokenIn: await uniV3PairManager.token0(),
            tokenOut: await uniV3PairManager.token1(),
            fee: await uniV3PairManager.fee(),
            recipient: whale._address,
            deadline: 1000000000000,
            amountIn: tenTokens,
            amountOutMinimum: bn_1.toUnit(0.00001),
            sqrtPriceLimitX96: 0,
        });
        await uniV3PairManager.connect(whale).mint(tenTokens, tenTokens, amount0MinIsZero, amount1MinIsZero, whale._address);
    }
    describe('collect', () => {
        context('when the contract has liquidity and accrued fees', () => {
            beforeEach(async () => {
                await provideLiquidityAndSwap();
            });
            it('should send the collected fees to governance', async () => {
                const tokensOwed0 = (await uniV3PairManager.position()).tokensOwed0;
                const tokensOwed1 = (await uniV3PairManager.position()).tokensOwed1;
                await uniV3PairManager.connect(governance).collect();
                chai_1.expect(await dai.balanceOf(governance.address)).to.equal(tokensOwed0);
                chai_1.expect(await weth.balanceOf(governance.address)).to.equal(tokensOwed1);
            });
        });
    });
    describe('burn', () => {
        context('when the contract has liquidity and accrued fees', () => {
            beforeEach(async () => {
                await provideLiquidityAndSwap();
                liquidity = (await uniV3PairManager.position()).liquidity;
            });
            it('should burn the provided liquidity', async () => {
                await uniV3PairManager.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, whale._address);
                chai_1.expect((await uniV3PairManager.position()).liquidity).to.equal(0);
            });
            it('should send the gathered fees to recipient', async () => {
                //check the initial balance is 0
                chai_1.expect(await dai.balanceOf(governance.address)).to.equal(0);
                chai_1.expect(await weth.balanceOf(governance.address)).to.equal(0);
                //expect the balance to grow after liquidity is burned and tokens are sent to him
                await uniV3PairManager.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, governance.address);
                chai_1.expect(await dai.balanceOf(governance.address)).to.be.gt(0);
                chai_1.expect(await weth.balanceOf(governance.address)).to.be.gt(0);
            });
            it('should burn credits from the user who burns liquidity', async () => {
                //check the caller has credits
                chai_1.expect(await uniV3PairManager.balanceOf(whale._address)).to.equal(liquidity);
                //check credits they're burned after calling burn
                await uniV3PairManager.connect(whale).burn(liquidity, amount0MinIsZero, amount1MinIsZero, whale._address);
                chai_1.expect(await uniV3PairManager.balanceOf(whale._address)).to.equal(0);
            });
        });
    });
});
