"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroGateSDK = void 0;
const validateKey_1 = require("./pipeline/validateKey");
const verifyRules_1 = require("./pipeline/verifyRules");
const detect_1 = require("./platform/detect");
const DEFAULT_PLATFORM_URL = 'https://next-app-ochre-zeta.vercel.app';
function fromEnv(name) {
    return typeof process !== 'undefined' ? process.env[name] : undefined;
}
class ZeroGateSDK {
    apiKey;
    userHash;
    platformApiUrl;
    platform;
    constructor(config = {}) {
        this.apiKey = config.apiKey ?? fromEnv('ZERO_API_KEY') ?? '';
        this.userHash = config.userHash ?? fromEnv('ZERO_USER_HASH') ?? '';
        this.platformApiUrl = config.platformApiUrl
            ?? fromEnv('ZERO_PLATFORM_URL')
            ?? DEFAULT_PLATFORM_URL;
        this.platform = (0, detect_1.detectPlatform)(config.platform);
        if (!this.apiKey) {
            throw new Error('Missing apiKey — set ZERO_API_KEY env or pass apiKey to constructor');
        }
        if (!this.userHash) {
            throw new Error('Missing userHash — set ZERO_USER_HASH env or pass userHash to constructor');
        }
        if (!this.platformApiUrl.startsWith('https://')) {
            throw new Error('platformApiUrl must use HTTPS');
        }
    }
    async run(request) {
        const executedAt = new Date().toISOString();
        const apiResponse = await (0, validateKey_1.validateKeyAndGetToken)({
            apiKey: this.apiKey,
            userHash: this.userHash,
            action: request.action,
            platform: request.platform ?? this.platform,
            text: request.text ?? '',
            executedAt,
            platformApiUrl: this.platformApiUrl,
        });
        if (!apiResponse.valid) {
            return { allowed: false, executedAt, error: apiResponse.error ?? 'invalid_credentials' };
        }
        const rulesResult = (0, verifyRules_1.verifyRules)({ apiResponse });
        if (rulesResult.blocked) {
            return { allowed: false, executedAt, error: rulesResult.error ?? 'action_not_permitted' };
        }
        return {
            allowed: true,
            executedAt,
            token: apiResponse.token,
            userId: apiResponse.userId,
            agentId: apiResponse.agentId,
        };
    }
}
exports.ZeroGateSDK = ZeroGateSDK;
