"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const client_1 = require("../http/client");
async function validate(params) {
    return (0, client_1.post)(`${params.platformApiUrl}/api/validate`, {
        token: params.token,
        hash: params.hash,
        action: params.action,
        platform: params.platform,
    });
}
