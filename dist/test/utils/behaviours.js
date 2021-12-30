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
exports.createOnlyCallableCheck = exports.onlyKeep3r = exports.onlySlasher = exports.onlyDisputer = exports.onlyJobOwner = exports.onlyPendingGovernance = exports.onlyGovernance = void 0;
const smock_1 = require("@defi-wonderland/smock");
const chai_1 = __importStar(require("chai"));
const _1 = require(".");
const bn_1 = require("./bn");
chai_1.default.use(smock_1.smock.matchers);
exports.onlyGovernance = createOnlyCallableCheck(['governance'], 'OnlyGovernance()');
exports.onlyPendingGovernance = createOnlyCallableCheck(['pending governance'], 'OnlyPendingGovernance()');
exports.onlyJobOwner = createOnlyCallableCheck(['job owner'], 'OnlyJobOwner()');
exports.onlyDisputer = createOnlyCallableCheck(['disputer'], 'OnlyDisputer()');
exports.onlySlasher = createOnlyCallableCheck(['slasher'], 'OnlySlasher()');
exports.onlyKeep3r = createOnlyCallableCheck(['keep3r'], 'OnlyKeep3r()');
function createOnlyCallableCheck(allowedLabels, error) {
    return (delayedContract, fnName, allowedWallet, args) => {
        allowedLabels.forEach((allowedLabel, index) => {
            it(`should be callable by ${allowedLabel}`, async () => {
                let impersonator = allowedWallet;
                if (typeof allowedWallet === 'function')
                    impersonator = allowedWallet();
                if (Array.isArray(impersonator))
                    impersonator = impersonator[index];
                return chai_1.expect(callFunction(impersonator)).not.to.be.revertedWith(error);
            });
        });
        it('should not be callable by any address', async () => {
            const any = await _1.wallet.generateRandom();
            await _1.contracts.setBalance(any.address, bn_1.toUnit(1000000));
            return chai_1.expect(callFunction(any)).to.be.revertedWith(error);
        });
        function callFunction(impersonator) {
            const argsArray = typeof args === 'function' ? args() : args;
            const fn = delayedContract().connect(impersonator)[fnName];
            return fn(...argsArray);
        }
    };
}
exports.createOnlyCallableCheck = createOnlyCallableCheck;
