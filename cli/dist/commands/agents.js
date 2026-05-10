"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agents = agents;
const api_1 = require("../api");
const config_1 = require("../config");
const print_1 = require("../util/print");
const prompt_1 = require("../util/prompt");
async function agents(args) {
    const sub = args[0];
    switch (sub) {
        case 'create':
            return create(args.slice(1));
        case 'list':
        case 'ls':
            return list();
        case undefined:
        case 'help':
        case '--help':
        case '-h':
            (0, print_1.info)(`Usage: zero agents <command>

Commands
  create [name]     Create a new agent and print credentials
  list              List your agents

Flags for create
  --name <name>     Agent name (default: prompted)
  --platform <p>    Platform identifier (default: cli)
  --type <t>        agent | mcp (default: agent)
`);
            return 0;
        default:
            (0, print_1.err)(`Unknown agents command: ${sub}`);
            return 1;
    }
}
async function create(args) {
    const cfg = (0, config_1.loadConfig)();
    if (!cfg.token) {
        (0, print_1.err)('Not signed in. Run `zero login` first.');
        return 1;
    }
    const positional = args.filter(a => !a.startsWith('-'));
    let name = pickFlag(args, '--name') ?? positional[0];
    const platform = pickFlag(args, '--platform') ?? 'cli';
    const type = (pickFlag(args, '--type') ?? 'agent');
    if (!name) {
        name = await (0, prompt_1.prompt)('Agent name: ');
        if (!name) {
            (0, print_1.err)('Name is required.');
            return 1;
        }
    }
    let res;
    try {
        res = await (0, api_1.apiRequest)('/api/agents', {
            method: 'POST',
            body: { name, platform, type },
        });
    }
    catch (e) {
        if (e instanceof api_1.APIError && e.status === 401) {
            (0, print_1.err)('Session expired. Run `zero login` again.');
            return 1;
        }
        (0, print_1.err)(e instanceof Error ? e.message : String(e));
        return 1;
    }
    (0, print_1.ok)(`Created agent ${(0, print_1.bold)(res.agent.name)}`);
    (0, print_1.kv)('id', res.agent.id);
    (0, print_1.kv)('type', res.agent.type);
    (0, print_1.kv)('platform', res.agent.platform);
    if (res.agent.mcp_url)
        (0, print_1.kv)('mcp url', res.agent.mcp_url);
    (0, print_1.info)('');
    (0, print_1.info)((0, print_1.yellow)('  Save these credentials now — the secret will not be shown again.'));
    (0, print_1.info)('');
    (0, print_1.info)(`  ${(0, print_1.dim)('# Add to your .env')}`);
    (0, print_1.info)(`  ${(0, print_1.cyan)('ZERO_AGENT_ID=')}${res.agent.id}`);
    (0, print_1.info)(`  ${(0, print_1.cyan)('ZERO_API_SECRET=')}${res.apiSecret}`);
    if (res.key) {
        (0, print_1.info)(`  ${(0, print_1.cyan)('ZERO_API_KEY=')}${res.key.plainKey}  ${(0, print_1.dim)(`# prefix ${res.key.prefix}`)}`);
    }
    (0, print_1.info)('');
    (0, print_1.info)((0, print_1.dim)('  Then in your code:'));
    (0, print_1.info)(`  ${(0, print_1.dim)("  import { ZeroGateSDK } from '@zero-gate/sdk';")}`);
    (0, print_1.info)(`  ${(0, print_1.dim)('  const gate = new ZeroGateSDK();')}`);
    (0, print_1.info)(`  ${(0, print_1.dim)('  await gate.run();')}`);
    return 0;
}
async function list() {
    const cfg = (0, config_1.loadConfig)();
    if (!cfg.token) {
        (0, print_1.err)('Not signed in. Run `zero login` first.');
        return 1;
    }
    let agents;
    try {
        agents = await (0, api_1.apiRequest)('/api/agents');
    }
    catch (e) {
        if (e instanceof api_1.APIError && e.status === 401) {
            (0, print_1.err)('Session expired. Run `zero login` again.');
            return 1;
        }
        (0, print_1.err)(e instanceof Error ? e.message : String(e));
        return 1;
    }
    if (agents.length === 0) {
        (0, print_1.warn)('No agents yet. Create one with `zero agents create`.');
        return 0;
    }
    for (const a of agents) {
        (0, print_1.info)(`${(0, print_1.bold)(a.name)} ${(0, print_1.dim)(`(${a.type})`)}`);
        (0, print_1.kv)('id', a.id);
        (0, print_1.kv)('platform', a.platform);
        (0, print_1.kv)('status', a.status);
        (0, print_1.kv)('created', a.created_at);
        if (a.mcp_url)
            (0, print_1.kv)('mcp url', a.mcp_url);
        (0, print_1.info)('');
    }
    return 0;
}
function pickFlag(args, name) {
    const i = args.indexOf(name);
    if (i === -1)
        return undefined;
    return args[i + 1];
}
