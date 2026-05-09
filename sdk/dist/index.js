"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentAuthSDK = void 0;
const validateKey_1 = require("./pipeline/validateKey");
const verifyScope_1 = require("./pipeline/verifyScope");
const verifyRules_1 = require("./pipeline/verifyRules");
class AgentAuthSDK {
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
        if (!(0, verifyScope_1.verifyScope)(request.action, apiResponse.scope ?? [])) {
            return { allowed: false, error: 'action_not_permitted' };
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
exports.AgentAuthSDK = AgentAuthSDK;
