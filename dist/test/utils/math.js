"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mathUtilsFactory = void 0;
const bn_1 = require("@utils/bn");
function mathUtilsFactory(rewardPeriodTime, inflationPeriodTime) {
    return {
        calcPeriod: (timestamp) => timestamp - (timestamp % rewardPeriodTime),
        calcLiquidityToAdd: (credits) => credits.mul(inflationPeriodTime).div(rewardPeriodTime),
        calcPeriodCredits: (liquidityAdded) => liquidityAdded.mul(rewardPeriodTime).div(inflationPeriodTime),
        calcMintedCredits: (jobPeriodCredits, cooldown) => jobPeriodCredits.mul(cooldown).div(rewardPeriodTime),
        increase1Tick: (amount) => amount.mul(10001).div(10000),
        decrease1Tick: (amount) => amount.mul(10000).div(10001),
        blockShiftPrecision: bn_1.toUnit(0.0001).toNumber(),
    };
}
exports.mathUtilsFactory = mathUtilsFactory;
