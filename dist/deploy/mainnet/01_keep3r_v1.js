"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const IKeep3rV1_json_1 = __importDefault(require("@solidity/interfaces/external/IKeep3rV1.sol/IKeep3rV1.json"));
const deployFunction = async function (hre) {
    const keep3rV1Address = '0x1cEB5cB57C4D4E2b2433641b95Dd330A33185A44';
    console.log(`using already deployed "Keep3rV1" at ${keep3rV1Address}`);
    hre.deployments.save('Keep3rV1', {
        address: keep3rV1Address,
        abi: IKeep3rV1_json_1.default.abi,
    });
};
deployFunction.tags = ['Keep3rV1', 'Keep3r', 'mainnet'];
exports.default = deployFunction;
