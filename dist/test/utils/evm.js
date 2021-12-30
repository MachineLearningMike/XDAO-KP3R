"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapshot = exports.reset = exports.advanceBlock = exports.advanceToTime = exports.advanceTime = exports.advanceToTimeAndBlock = exports.advanceTimeAndBlock = void 0;
const hardhat_1 = require("hardhat");
const advanceTimeAndBlock = async (time) => {
    await exports.advanceTime(time);
    await exports.advanceBlock();
};
exports.advanceTimeAndBlock = advanceTimeAndBlock;
const advanceToTimeAndBlock = async (time) => {
    await exports.advanceToTime(time);
    await exports.advanceBlock();
};
exports.advanceToTimeAndBlock = advanceToTimeAndBlock;
const advanceTime = async (time) => {
    await hardhat_1.network.provider.request({
        method: 'evm_increaseTime',
        params: [time],
    });
};
exports.advanceTime = advanceTime;
const advanceToTime = async (time) => {
    await hardhat_1.network.provider.request({
        method: 'evm_setNextBlockTimestamp',
        params: [time],
    });
};
exports.advanceToTime = advanceToTime;
const advanceBlock = async () => {
    await hardhat_1.network.provider.request({
        method: 'evm_mine',
        params: [],
    });
};
exports.advanceBlock = advanceBlock;
const reset = async (forking) => {
    const params = forking ? [{ forking }] : [];
    await hardhat_1.network.provider.request({
        method: 'hardhat_reset',
        params,
    });
};
exports.reset = reset;
class SnapshotManager {
    constructor() {
        this.snapshots = {};
    }
    async take() {
        const id = await this.takeSnapshot();
        this.snapshots[id] = id;
        return id;
    }
    async revert(id) {
        await this.revertSnapshot(this.snapshots[id]);
        this.snapshots[id] = await this.takeSnapshot();
    }
    async takeSnapshot() {
        return (await hardhat_1.network.provider.request({
            method: 'evm_snapshot',
            params: [],
        }));
    }
    async revertSnapshot(id) {
        await hardhat_1.network.provider.request({
            method: 'evm_revert',
            params: [id],
        });
    }
}
exports.snapshot = new SnapshotManager();
