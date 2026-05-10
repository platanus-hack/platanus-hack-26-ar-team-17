"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNonce = generateNonce;
exports.buildPayload = buildPayload;
exports.signPayload = signPayload;
const crypto_1 = __importDefault(require("crypto"));
function generateNonce() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
function buildPayload(agentId, timestamp, nonce, action, platform) {
    return `${agentId}|${timestamp}|${nonce}|${action}|${platform}`;
}
function signPayload(secret, payload) {
    return crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
}
