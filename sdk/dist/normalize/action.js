"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAction = normalizeAction;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;
function normalizeAction(action) {
    return action.replace(CONTROL_CHARS, '').trim().toLowerCase();
}
