"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readArgFromEventOrFail = exports.readArgsFromEvent = exports.readArgFromEvent = void 0;
async function readArgFromEvent(response, eventName, paramName) {
    const receipt = await response.wait();
    for (const event of getEvents(receipt)) {
        if (event.event === eventName) {
            return event.args[paramName];
        }
    }
}
exports.readArgFromEvent = readArgFromEvent;
async function readArgsFromEvent(response, eventName) {
    const receipt = await response.wait();
    return getEvents(receipt)
        .filter(({ event }) => event === eventName)
        .map((event) => event.args);
}
exports.readArgsFromEvent = readArgsFromEvent;
async function readArgFromEventOrFail(response, eventName, paramName) {
    const result = await readArgFromEvent(response, eventName, paramName);
    if (result) {
        return result;
    }
    throw new Error(`Failed to find event with name ${eventName}`);
}
exports.readArgFromEventOrFail = readArgFromEventOrFail;
function getEvents(receipt) {
    // @ts-ignore
    return receipt.events;
}
