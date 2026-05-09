"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroGateSDK = void 0;
const validateKey_1 = require("./pipeline/validateKey");
const detect_1 = require("./platform/detect");
function fromEnv(name) {
    return typeof process !== 'undefined' ? process.env[name] : undefined;
}
class ZeroGateSDK {
    apiKey;
    userHash;
    platform;
    constructor(config = {}) {
        this.apiKey = config.apiKey ?? fromEnv('ZERO_API_KEY') ?? '';
        this.userHash = config.userHash ?? fromEnv('ZERO_USER_HASH') ?? '';
        this.platform = (0, detect_1.detectPlatform)();
        if (!this.apiKey)
            throw new Error('Missing apiKey — set ZERO_API_KEY env');
        if (!this.userHash)
            throw new Error('Missing userHash — set ZERO_USER_HASH env');
    }
    async run() {
        return (0, validateKey_1.validate)({
            token: this.apiKey,
            hash: this.userHash,
            action: (0, detect_1.detectAction)(),
            platform: this.platform,
            platformApiUrl: detect_1.PLATFORM_API_URL,
        });
    }
}
exports.ZeroGateSDK = ZeroGateSDK;
