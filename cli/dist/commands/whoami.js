"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whoami = whoami;
const api_1 = require("../api");
const config_1 = require("../config");
const print_1 = require("../util/print");
async function whoami() {
    const cfg = (0, config_1.loadConfig)();
    if (!cfg.token) {
        (0, print_1.err)('Not signed in. Run `zero login` first.');
        return 1;
    }
    try {
        const session = await (0, api_1.apiRequest)('/api/auth/session');
        (0, print_1.ok)(`Signed in as ${session.displayName}`);
        (0, print_1.kv)('user', session.userId);
        (0, print_1.kv)('endpoint', cfg.apiUrl);
        if (session.kycStatus)
            (0, print_1.kv)('kyc', session.kycStatus);
        return 0;
    }
    catch (e) {
        if (e instanceof api_1.APIError && e.status === 401) {
            (0, print_1.err)('Session expired. Run `zero login` to sign in again.');
            return 1;
        }
        (0, print_1.err)(e instanceof Error ? e.message : String(e));
        return 1;
    }
}
