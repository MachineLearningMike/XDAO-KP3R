"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.when = exports.given = exports.then = void 0;
exports.then = it;
exports.given = beforeEach;
exports.when = function (title, fn) {
    context('when ' + title, fn);
};
exports.when.only = (title, fn) => context.only('when ' + title, fn);
exports.when.skip = (title, fn) => context.skip('when ' + title, fn);
