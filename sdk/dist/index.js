"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroGateSDK = void 0;
const validateKey_1 = require("./pipeline/validateKey");
const detect_1 = require("./platform/detect");
function fromEnv(name) {
    return typeof process !== 'undefined' ? process.env[name] : undefined;
}
class ZeroGateSDK {
    agentId;
    apiSecret;
    platform;
    constructor(config = {}) {
        this.agentId = config.agentId ?? fromEnv('ZERO_AGENT_ID') ?? '';
        this.apiSecret = config.apiSecret ?? fromEnv('ZERO_API_SECRET') ?? '';
        this.platform = (0, detect_1.detectPlatform)();
        if (!this.agentId)
            throw new Error('Missing agentId — set ZERO_AGENT_ID env');
        if (!this.apiSecret)
            throw new Error('Missing apiSecret — set ZERO_API_SECRET env');
    }
    async run() {
        return (0, validateKey_1.validate)({
            agentId: this.agentId,
            apiSecret: this.apiSecret,
            action: (0, detect_1.detectAction)(),
            platform: this.platform,
            platformApiUrl: detect_1.PLATFORM_API_URL,
        });
    }
}
exports.ZeroGateSDK = ZeroGateSDK;
