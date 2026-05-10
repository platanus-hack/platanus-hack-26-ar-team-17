"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedToken = getCachedToken;
exports.setCachedToken = setCachedToken;
exports.clearCache = clearCache;
let cached = null;
// Return the cached token if it hasn't expired yet (with a 30s buffer).
function getCachedToken() {
    if (!cached)
        return null;
    if (Date.now() >= cached.expiresAt - 30_000) {
        cached = null;
        return null;
    }
    return cached.token;
}
function setCachedToken(token, expiresAt) {
    cached = { token, expiresAt: new Date(expiresAt).getTime() };
}
function clearCache() {
    cached = null;
}
