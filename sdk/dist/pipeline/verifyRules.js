"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRules = verifyRules;
function verifyRules(params) {
    if (!params.apiResponse.valid || params.apiResponse.error === 'action_not_permitted') {
        return { blocked: true, error: params.apiResponse.error };
    }
    return { blocked: false };
}
