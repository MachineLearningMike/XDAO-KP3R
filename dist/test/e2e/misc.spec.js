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
const _utils_1 = require("@utils");
const bn_1 = require("@utils/bn");
const evm_1 = require("@utils/evm");
const chai_1 = require("chai");
const common = __importStar(require("./common"));
describe('@skip-on-coverage Miscellaneous', () => {
    let ethWhale;
    let keep3r;
    let snapshotId;
    beforeEach(async () => {
        await _utils_1.evm.reset({
            jsonRpcUrl: process.env.MAINNET_HTTPS_URL,
            blockNumber: common.FORK_BLOCK_NUMBER,
        });
        ethWhale = await _utils_1.wallet.impersonate(common.RICH_ETH_ADDRESS);
        ({ keep3r } = await common.setupKeep3r());
        snapshotId = await evm_1.snapshot.take();
    });
    beforeEach(async () => {
        evm_1.snapshot.revert(snapshotId);
    });
    it('should fail to transfer ether to the contract', async () => {
        await chai_1.expect(ethWhale.sendTransaction({
            to: keep3r.address,
            value: bn_1.toUnit(1),
        })).to.be.revertedWith(`function selector was not recognized and there's no fallback nor receive function`);
    });
});
