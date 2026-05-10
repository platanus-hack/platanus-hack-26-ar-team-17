"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = logout;
const config_1 = require("../config");
const print_1 = require("../util/print");
async function logout() {
    (0, config_1.clearConfig)();
    (0, print_1.ok)('Signed out.');
    process.stdout.write(`  ${(0, print_1.dim)(`removed ${(0, config_1.configPath)()}`)}\n`);
    return 0;
}
