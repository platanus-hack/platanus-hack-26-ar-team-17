"use strict";
/**
 * Auto-detects platform & action from the runtime environment.
 * Internal — never exposed to the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPlatform = detectPlatform;
exports.detectPlatformApiUrl = detectPlatformApiUrl;
exports.detectAction = detectAction;
const DEFAULT_URL = 'https://next-app-ochre-zeta.vercel.app';
function detectPlatform() {
    if (typeof process === 'undefined')
        return 'custom';
    if (process.env.ZERO_PLATFORM)
        return process.env.ZERO_PLATFORM;
    try {
        require.resolve('@modelcontextprotocol/sdk');
        return 'mcp';
    }
    catch { }
    return 'custom';
}
function detectPlatformApiUrl() {
    if (typeof process !== 'undefined' && process.env.ZERO_PLATFORM_URL) {
        return process.env.ZERO_PLATFORM_URL;
    }
    return DEFAULT_URL;
}
/**
 * Inspects the call stack to infer the action name.
 * Walks back past internal SDK frames and uses the first user-land function name.
 * Falls back to 'execute' if not determinable.
 */
function detectAction() {
    const err = new Error();
    const stack = err.stack ?? '';
    const lines = stack.split('\n').slice(1);
    for (const raw of lines) {
        const line = raw.trim();
        // Skip SDK internals
        if (line.includes('zero-gate/sdk') || line.includes('@zero-gate'))
            continue;
        if (line.includes('node_modules'))
            continue;
        if (line.includes('platform/detect'))
            continue;
        if (line.includes('ZeroGateSDK'))
            continue;
        // Match: "at functionName (file:line:col)" or "at file:line:col"
        const m = line.match(/at\s+(?:async\s+)?([^\s(]+)\s*\(/);
        if (m && m[1] && !['Object.<anonymous>', 'Module._compile'].includes(m[1])) {
            const name = m[1].split('.').pop();
            if (name && name !== 'run' && !name.startsWith('_'))
                return name;
        }
    }
    return 'execute';
}
