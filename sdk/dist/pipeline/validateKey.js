"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const client_1 = require("../http/client");
const hmac_1 = require("../crypto/hmac");
const cache_1 = require("../auth/cache");
async function validate(params) {
    const { agentId, apiSecret, action, platform, platformApiUrl } = params;
    const cached = (0, cache_1.getCachedToken)();
    if (cached)
        return { allowed: true, token: cached };
    const nonce = (0, hmac_1.generateNonce)();
    const timestamp = new Date().toISOString();
    const payload = (0, hmac_1.buildPayload)(agentId, timestamp, nonce, action, platform);
    const signature = (0, hmac_1.signPayload)(apiSecret, payload);
    const res = await (0, client_1.post)(`${platformApiUrl}/api/validate`, {
        agentId,
        timestamp,
        nonce,
        action,
        platform,
        signature,
    });
    if (res.allowed && res.token && res.expiresAt) {
        (0, cache_1.setCachedToken)(res.token, res.expiresAt);
    }
    return { allowed: res.allowed, token: res.token };
}
