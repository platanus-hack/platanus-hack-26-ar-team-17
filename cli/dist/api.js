"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIError = void 0;
exports.apiRequest = apiRequest;
const config_1 = require("./config");
class APIError extends Error {
    status;
    body;
    constructor(status, message, body) {
        super(message);
        this.status = status;
        this.body = body;
    }
}
exports.APIError = APIError;
async function apiRequest(pathname, opts = {}) {
    const cfg = (0, config_1.loadConfig)();
    const apiUrl = (opts.apiUrl ?? cfg.apiUrl).replace(/\/$/, '');
    const token = opts.token ?? cfg.token;
    const headers = { Accept: 'application/json' };
    if (token)
        headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined)
        headers['Content-Type'] = 'application/json';
    let res;
    try {
        res = await fetch(`${apiUrl}${pathname}`, {
            method: opts.method ?? 'GET',
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        });
    }
    catch (e) {
        throw new APIError(0, `Could not reach ${apiUrl} — is it running?`);
    }
    const text = await res.text();
    let parsed = undefined;
    if (text) {
        try {
            parsed = JSON.parse(text);
        }
        catch {
            parsed = text;
        }
    }
    if (!res.ok) {
        const msg = (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
            ? parsed.error
            : null) ??
            (parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string'
                ? parsed.message
                : null) ??
            `HTTP ${res.status}`;
        throw new APIError(res.status, msg, parsed);
    }
    return parsed;
}
