"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLiquidityToPair = exports.createLiquidityPair = exports.createJobForTest = exports.setupKeep3rV1 = exports.setupKeep3r = exports.KP3R_V1_GOVERNANCE_ADDRESS = exports.KP3R_V1_PROXY_GOVERNANCE_ADDRESS = exports.KP3R_V1_PROXY_ADDRESS = exports.KP3R_V1_ADDRESS = exports.UNISWAP_V2_FACTORY_ADDRESS = exports.UNISWAP_V2_ROUTER_02_ADDRESS = exports.KP3R_WETH_V3_POOL_ADDRESS = exports.KP3R_WETH_POOL_ADDRESS = exports.RICH_KP3R_WETH_POOL_ADDRESS = exports.RICH_KP3R_ADDRESS = exports.RICH_WETH_ADDRESS = exports.RICH_ETH_DAI_ADDRESS = exports.RICH_ETH_ADDRESS = exports.WETH_ADDRESS = exports.DAI_ADDRESS = exports.FORK_BLOCK_NUMBER = void 0;
const _utils_1 = require("@utils");
const bn_1 = require("@utils/bn");
const hardhat_1 = require("hardhat");
exports.FORK_BLOCK_NUMBER = 13232191;
exports.DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
exports.WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
exports.RICH_ETH_ADDRESS = '0xcA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa';
exports.RICH_ETH_DAI_ADDRESS = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0';
exports.RICH_WETH_ADDRESS = '0x56178a0d5f301baf6cf3e1cd53d9863437345bf9';
exports.RICH_KP3R_ADDRESS = '0xf977814e90da44bfa03b6295a0616a897441acec';
exports.RICH_KP3R_WETH_POOL_ADDRESS = '0x2269522ad48aeb971b25042471a44acc8c1b5eca';
exports.KP3R_WETH_POOL_ADDRESS = '0xaf988afF99d3d0cb870812C325C588D8D8CB7De8';
exports.KP3R_WETH_V3_POOL_ADDRESS = '0x11B7a6bc0259ed6Cf9DB8F499988F9eCc7167bf5';
exports.UNISWAP_V2_ROUTER_02_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
exports.UNISWAP_V2_FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
exports.KP3R_V1_ADDRESS = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
exports.KP3R_V1_PROXY_ADDRESS = '0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d';
exports.KP3R_V1_PROXY_GOVERNANCE_ADDRESS = '0x0d5dc686d0a2abbfdafdfb4d0533e886517d4e83';
exports.KP3R_V1_GOVERNANCE_ADDRESS = '0x0d5dc686d0a2abbfdafdfb4d0533e886517d4e83';
async function setupKeep3r() {
    // create governance with some eth
    const governance = await _utils_1.wallet.impersonate(_utils_1.wallet.generateRandomAddress());
    await _utils_1.contracts.setBalance(governance._address, bn_1.toUnit(1000));
    // deploy proxy and set it as Keep3rV1 governance
    const { keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance } = await setupKeep3rV1();
    const helperFactory = (await hardhat_1.ethers.getContractFactory('Keep3rHelper'));
    const keep3rFactory = (await hardhat_1.ethers.getContractFactory('Keep3r'));
    // calculate keep3rV2 deployment address
    const currentNonce = await hardhat_1.ethers.provider.getTransactionCount(governance._address);
    const keeperV2Address = hardhat_1.ethers.utils.getContractAddress({ from: governance._address, nonce: currentNonce + 1 });
    // deploy Keep3rHelper and Keep3r contract
    const helper = await helperFactory.deploy(keeperV2Address);
    const keep3r = await keep3rFactory.deploy(governance._address, helper.address, keep3rV1.address, keep3rV1Proxy.address, exports.KP3R_WETH_V3_POOL_ADDRESS);
    // set Keep3r as proxy minter
    await keep3rV1Proxy.connect(keep3rV1ProxyGovernance).setMinter(keep3r.address);
    // give some eth to Keep3r and to Keep3rV1
    await _utils_1.contracts.setBalance(keep3r.address, bn_1.toUnit(1000));
    await _utils_1.contracts.setBalance(keep3rV1.address, bn_1.toUnit(1000));
    return { governance, keep3r, keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance, helper };
}
exports.setupKeep3r = setupKeep3r;
async function setupKeep3rV1() {
    // get Keep3rV1 and it's governance
    const keep3rV1 = (await hardhat_1.ethers.getContractAt('IKeep3rV1', exports.KP3R_V1_ADDRESS));
    const keep3rV1Proxy = (await hardhat_1.ethers.getContractAt('IKeep3rV1Proxy', exports.KP3R_V1_PROXY_ADDRESS));
    const keep3rV1Governance = await _utils_1.wallet.impersonate(exports.KP3R_V1_GOVERNANCE_ADDRESS);
    const keep3rV1ProxyGovernance = await _utils_1.wallet.impersonate(exports.KP3R_V1_PROXY_GOVERNANCE_ADDRESS);
    // send some ETH to keep3r V1 Governance
    const ethWhale = await _utils_1.wallet.impersonate(exports.RICH_ETH_ADDRESS);
    await ethWhale.sendTransaction({ value: bn_1.toUnit(500), to: keep3rV1Governance._address });
    // set proxy as Keep3rV1 governance
    await keep3rV1.connect(keep3rV1Governance).setGovernance(keep3rV1Proxy.address);
    await keep3rV1Proxy.connect(keep3rV1ProxyGovernance).acceptKeep3rV1Governance();
    return { keep3rV1, keep3rV1Proxy, keep3rV1ProxyGovernance };
}
exports.setupKeep3rV1 = setupKeep3rV1;
async function createJobForTest(keep3rAddress, jobOwner) {
    const jobFactory = (await hardhat_1.ethers.getContractFactory('JobForTest'));
    return await jobFactory.connect(jobOwner).deploy(keep3rAddress);
}
exports.createJobForTest = createJobForTest;
async function createLiquidityPair(governance) {
    return await (await hardhat_1.ethers.getContractFactory('UniV3PairManager')).deploy(exports.KP3R_WETH_V3_POOL_ADDRESS, governance._address);
}
exports.createLiquidityPair = createLiquidityPair;
async function addLiquidityToPair(richGuy, pair, amount, jobOwner) {
    const weth = (await hardhat_1.ethers.getContractAt('ERC20ForTest', exports.WETH_ADDRESS));
    const keep3rV1 = (await hardhat_1.ethers.getContractAt('ERC20', exports.KP3R_V1_ADDRESS));
    const initialBalance = await keep3rV1.balanceOf(richGuy._address);
    // fund RICH_KP3R address with WETH
    await weth.connect(richGuy).deposit(amount, { value: amount });
    // make ERC20 approvals to mint liquidity
    await weth.connect(richGuy).approve(pair.address, amount);
    await keep3rV1.connect(richGuy).approve(pair.address, amount);
    // mint liquidity in UniV3PairManager
    const liquidity = await pair.connect(richGuy).callStatic.mint(amount, amount, 0, 0, richGuy._address);
    await pair.connect(richGuy).mint(amount, amount, 0, 0, richGuy._address);
    // transfers, approves and adds liquidity to job
    await pair.connect(richGuy).transfer(jobOwner._address, liquidity);
    const spentKp3rs = initialBalance.sub(await keep3rV1.balanceOf(richGuy._address));
    return { liquidity, spentKp3rs };
}
exports.addLiquidityToPair = addLiquidityToPair;
