"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroGateSDK = void 0;
const validateKey_1 = require("./pipeline/validateKey");
const detect_1 = require("./platform/detect");
const cache_1 = require("./auth/cache");
const challengeFlow_1 = require("./auth/challengeFlow");
function fromEnv(name) {
    return typeof process !== 'undefined' ? process.env[name] : undefined;
}
class ZeroGateSDK {
    agentId;
    apiSecret;
    privateKey;
    privateKeyPqc;
    platform;
    platformApiUrl;
    mode;
    constructor(config = {}) {
        this.agentId = config.agentId ?? fromEnv('ZERO_AGENT_ID') ?? '';
        this.apiSecret = config.apiSecret ?? fromEnv('ZERO_API_SECRET') ?? '';
        this.privateKey = config.privateKey ?? fromEnv('ZERO_PRIVATE_KEY') ?? '';
        this.privateKeyPqc = config.privateKeyPqc ?? fromEnv('ZERO_PRIVATE_KEY_PQC') ?? '';
        this.platformApiUrl = config.platformApiUrl ?? fromEnv('ZERO_PLATFORM_API_URL') ?? detect_1.PLATFORM_API_URL;
        this.platform = (0, detect_1.detectPlatform)();
        if (this.agentId && this.privateKey) {
            this.mode = 'ed25519';
        }
        else if (this.agentId && this.apiSecret) {
            this.mode = 'hmac';
        }
        else {
            throw new Error('Missing credentials — provide (agentId + privateKey) for Ed25519 mode, ' +
                'or (agentId + apiSecret) for HMAC mode');
        }
    }
    async run() {
        if (this.mode === 'ed25519') {
            const cached = (0, cache_1.getCachedToken)();
            if (cached)
                return { allowed: true, token: cached };
            const { token, receipt } = await (0, challengeFlow_1.performChallengeFlow)(this.agentId, this.privateKey, (0, detect_1.detectAction)(), this.platform, this.platformApiUrl, this.privateKeyPqc || undefined);
            return { allowed: true, token, receipt };
        }
        // HMAC mode
        const result = await (0, validateKey_1.validate)({
            agentId: this.agentId,
            apiSecret: this.apiSecret,
            action: (0, detect_1.detectAction)(),
            platform: this.platform,
            platformApiUrl: this.platformApiUrl,
        });
        return result;
    }
}
exports.ZeroGateSDK = ZeroGateSDK;
