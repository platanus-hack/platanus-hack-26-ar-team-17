"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyScope = verifyScope;
const action_1 = require("../normalize/action");
function verifyScope(action, scope) {
    const normalized = (0, action_1.normalizeAction)(action);
    return scope.map(action_1.normalizeAction).includes(normalized);
}
