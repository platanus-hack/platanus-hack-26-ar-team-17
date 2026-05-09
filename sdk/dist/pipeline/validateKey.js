"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateKeyAndGetToken = validateKeyAndGetToken;
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("../http/client");
const action_1 = require("../normalize/action");
const text_1 = require("../normalize/text");
function hashKey(key) {
    return crypto_1.default.createHash('sha256').update(key).digest('hex');
}
async function validateKeyAndGetToken(params) {
    return (0, client_1.post)(`${params.platformApiUrl}/api/validate`, {
        api_key: hashKey(params.apiKey),
        user_hash: params.userHash,
        action: (0, action_1.normalizeAction)(params.action),
        platform: params.platform,
        text: (0, text_1.normalizeText)(params.text),
        executed_at: params.executedAt,
    });
}
