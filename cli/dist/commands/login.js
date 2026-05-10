"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const api_1 = require("../api");
const config_1 = require("../config");
const print_1 = require("../util/print");
const prompt_1 = require("../util/prompt");
async function login(args) {
    const flagToken = pickFlag(args, '--token');
    const flagUrl = pickFlag(args, '--url');
    const existing = (0, config_1.loadConfig)();
    const apiUrl = (flagUrl ?? existing.apiUrl).replace(/\/$/, '');
    (0, print_1.info)((0, print_1.dim)(`Logging in to ${apiUrl}`));
    (0, print_1.info)((0, print_1.dim)('Open the dashboard, copy your CLI token, and paste it here.'));
    (0, print_1.info)('');
    let token = flagToken;
    if (!token) {
        token = await (0, prompt_1.promptHidden)('CLI token: ');
    }
    if (!token) {
        (0, print_1.err)('No token provided.');
        return 1;
    }
    let session;
    try {
        session = await (0, api_1.apiRequest)('/api/auth/session', {
            token,
            apiUrl,
        });
    }
    catch (e) {
        if (e instanceof api_1.APIError && e.status === 401) {
            (0, print_1.err)('Token rejected by the server.');
        }
        else if (e instanceof api_1.APIError) {
            (0, print_1.err)(e.message);
        }
        else {
            (0, print_1.err)(String(e));
        }
        return 1;
    }
    (0, config_1.saveConfig)({
        apiUrl,
        token,
        userId: session.userId,
        displayName: session.displayName,
    });
    (0, print_1.ok)(`Signed in as ${session.displayName}`);
    (0, print_1.kv)('user', session.userId);
    (0, print_1.kv)('endpoint', apiUrl);
    return 0;
}
function pickFlag(args, name) {
    const i = args.indexOf(name);
    if (i === -1)
        return undefined;
    return args[i + 1];
}
