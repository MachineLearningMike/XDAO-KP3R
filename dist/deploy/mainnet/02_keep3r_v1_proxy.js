"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const IKeep3rV1Proxy_json_1 = __importDefault(require("@solidity/interfaces/external/IKeep3rV1Proxy.sol/IKeep3rV1Proxy.json"));
const deployFunction = async function (hre) {
    const keep3rV1ProxyAddress = '0xFC48aC750959d5d5aE9A4bb38f548A7CA8763F8d';
    console.log(`using already deployed "Keep3rV1Proxy" at ${keep3rV1ProxyAddress}`);
    hre.deployments.save('Keep3rV1Proxy', {
        address: keep3rV1ProxyAddress,
        abi: IKeep3rV1Proxy_json_1.default.abi,
    });
};
deployFunction.tags = ['Keep3rV1Proxy', 'Keep3r', 'mainnet'];
exports.default = deployFunction;
