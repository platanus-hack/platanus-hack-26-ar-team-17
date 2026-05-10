#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const login_1 = require("./commands/login");
const logout_1 = require("./commands/logout");
const whoami_1 = require("./commands/whoami");
const agents_1 = require("./commands/agents");
const init_1 = require("./commands/init");
const print_1 = require("./util/print");
const VERSION = '0.1.0';
async function main() {
    const argv = process.argv.slice(2);
    const cmd = argv[0];
    const rest = argv.slice(1);
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
        printHelp();
        return 0;
    }
    if (cmd === '--version' || cmd === '-v') {
        (0, print_1.info)(VERSION);
        return 0;
    }
    switch (cmd) {
        case 'login':
            return (0, login_1.login)(rest);
        case 'logout':
            return (0, logout_1.logout)();
        case 'whoami':
            return (0, whoami_1.whoami)();
        case 'agents':
            return (0, agents_1.agents)(rest);
        case 'init':
            return (0, init_1.init)(rest);
        default:
            (0, print_1.err)(`Unknown command: ${cmd}`);
            (0, print_1.info)('');
            printHelp();
            return 1;
    }
}
function printHelp() {
    (0, print_1.info)(`${(0, print_1.bold)('zero')} ${(0, print_1.dim)(`v${VERSION}`)} — Zero Gate developer CLI

${(0, print_1.bold)('Usage')}
  zero <command> [...flags]

${(0, print_1.bold)('Commands')}
  login              Sign in with a CLI token from the dashboard
  logout             Remove local credentials
  whoami             Show the current signed-in user
  init               Add @zero-gate/sdk to the current project
  agents create      Create an agent and print credentials
  agents list        List your agents

${(0, print_1.bold)('Environment')}
  ZEROGATE_URL       Override the API URL (default http://localhost:3000)
  ZEROGATE_TOKEN     Override the stored CLI token (useful in CI)

${(0, print_1.bold)('Examples')}
  zero login
  zero agents create my-bot --platform slack
  ZEROGATE_URL=https://zero.example.com zero whoami
`);
}
main().then(code => process.exit(code), e => {
    (0, print_1.err)(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
