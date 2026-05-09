"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroGateSDK = void 0;
const validateKey_1 = require("./pipeline/validateKey");
const verifyRules_1 = require("./pipeline/verifyRules");
class ZeroGateSDK {
    config;
    constructor(config) {
        if (!config.platformApiUrl.startsWith('https://')) {
            throw new Error('platformApiUrl must use HTTPS');
        }
        this.config = config;
    }
    async run(request) {
        const apiResponse = await (0, validateKey_1.validateKeyAndGetToken)({
            apiKey: request.apiKey,
            action: request.action,
            platform: request.platform,
            text: request.text ?? '',
            platformApiUrl: this.config.platformApiUrl,
        });
        if (!apiResponse.valid) {
            return { allowed: false, error: apiResponse.error ?? 'invalid_api_key' };
        }
        const rulesResult = (0, verifyRules_1.verifyRules)({ apiResponse });
        if (rulesResult.blocked) {
            return { allowed: false, error: rulesResult.error ?? 'action_not_permitted' };
        }
        return {
            allowed: true,
            token: apiResponse.token,
            userId: apiResponse.userId,
        };
    }
}
exports.ZeroGateSDK = ZeroGateSDK;
