"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toGwei = exports.toUnit = exports.toBN = exports.expectToEqualWithThreshold = void 0;
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const expectToEqualWithThreshold = ({ value, to, threshold, }) => {
    value = exports.toBN(value);
    to = exports.toBN(to);
    threshold = exports.toBN(threshold);
    chai_1.expect(to.sub(threshold).lte(value) && to.add(threshold).gte(value), `Expected ${value.toString()} to be between ${to.sub(threshold).toString()} and ${to.add(threshold).toString()}`).to.be.true;
};
exports.expectToEqualWithThreshold = expectToEqualWithThreshold;
const toBN = (value) => {
    return ethers_1.BigNumber.isBigNumber(value) ? value : ethers_1.BigNumber.from(value);
};
exports.toBN = toBN;
const toUnit = (value) => {
    return ethers_1.utils.parseUnits(value.toString());
};
exports.toUnit = toUnit;
const toGwei = (value) => {
    return ethers_1.utils.parseUnits(value.toString(), 'gwei');
};
exports.toGwei = toGwei;
