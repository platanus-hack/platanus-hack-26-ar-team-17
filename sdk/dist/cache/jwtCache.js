"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedToken = getCachedToken;
exports.setCachedToken = setCachedToken;
exports.clearCachedToken = clearCachedToken;
const cache = new Map();
const BUFFER_MS = 30_000; // refresh 30s before actual expiry
function getCachedToken(agentId) {
    const entry = cache.get(agentId);
    if (!entry)
        return null;
    if (Date.now() >= entry.expiresAt - BUFFER_MS) {
        cache.delete(agentId);
        return null;
    }
    return entry.token;
}
function setCachedToken(agentId, token, expiresAt) {
    cache.set(agentId, { token, expiresAt: new Date(expiresAt).getTime() });
}
function clearCachedToken(agentId) {
    cache.delete(agentId);
}
