import { apiRequest, APIError } from '../api';
import { loadConfig } from '../config';
import { bold, cyan, dim, err, info, kv, ok, warn, yellow } from '../util/print';
import { prompt } from '../util/prompt';

interface CreateAgentResponse {
  agent: {
    id: string;
    name: string;
    type: 'agent' | 'mcp';
    platform: string;
    status: string;
    mcp_url: string | null;
  };
  key: { id: string; plainKey: string; prefix: string } | null;
  apiSecret: string;
}

interface AgentListItem {
  id: string;
  name: string;
  type: 'agent' | 'mcp';
  platform: string;
  status: string;
  created_at: string;
  mcp_url: string | null;
  api_secret: string | null;
}

export async function agents(args: string[]): Promise<number> {
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
      info(`Usage: zero agents <command>

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
      err(`Unknown agents command: ${sub}`);
      return 1;
  }
}

async function create(args: string[]): Promise<number> {
  const cfg = loadConfig();
  if (!cfg.token) {
    err('Not signed in. Run `zero login` first.');
    return 1;
  }

  const positional = args.filter(a => !a.startsWith('-'));
  let name = pickFlag(args, '--name') ?? positional[0];
  const platform = pickFlag(args, '--platform') ?? 'cli';
  const type = (pickFlag(args, '--type') ?? 'agent') as 'agent' | 'mcp';

  if (!name) {
    name = await prompt('Agent name: ');
    if (!name) {
      err('Name is required.');
      return 1;
    }
  }

  let res: CreateAgentResponse;
  try {
    res = await apiRequest<CreateAgentResponse>('/api/agents', {
      method: 'POST',
      body: { name, platform, type },
    });
  } catch (e) {
    if (e instanceof APIError && e.status === 401) {
      err('Session expired. Run `zero login` again.');
      return 1;
    }
    err(e instanceof Error ? e.message : String(e));
    return 1;
  }

  ok(`Created agent ${bold(res.agent.name)}`);
  kv('id', res.agent.id);
  kv('type', res.agent.type);
  kv('platform', res.agent.platform);
  if (res.agent.mcp_url) kv('mcp url', res.agent.mcp_url);

  info('');
  info(yellow('  Save these credentials now — the secret will not be shown again.'));
  info('');
  info(`  ${dim('# Add to your .env')}`);
  info(`  ${cyan('ZERO_AGENT_ID=')}${res.agent.id}`);
  info(`  ${cyan('ZERO_API_SECRET=')}${res.apiSecret}`);
  if (res.key) {
    info(`  ${cyan('ZERO_API_KEY=')}${res.key.plainKey}  ${dim(`# prefix ${res.key.prefix}`)}`);
  }
  info('');
  info(dim('  Then in your code:'));
  info(`  ${dim("  import { ZeroGateSDK } from '@zero-gate/sdk';")}`);
  info(`  ${dim('  const gate = new ZeroGateSDK();')}`);
  info(`  ${dim('  await gate.run();')}`);
  return 0;
}

async function list(): Promise<number> {
  const cfg = loadConfig();
  if (!cfg.token) {
    err('Not signed in. Run `zero login` first.');
    return 1;
  }

  let agents: AgentListItem[];
  try {
    agents = await apiRequest<AgentListItem[]>('/api/agents');
  } catch (e) {
    if (e instanceof APIError && e.status === 401) {
      err('Session expired. Run `zero login` again.');
      return 1;
    }
    err(e instanceof Error ? e.message : String(e));
    return 1;
  }

  if (agents.length === 0) {
    warn('No agents yet. Create one with `zero agents create`.');
    return 0;
  }

  for (const a of agents) {
    info(`${bold(a.name)} ${dim(`(${a.type})`)}`);
    kv('id', a.id);
    kv('platform', a.platform);
    kv('status', a.status);
    kv('created', a.created_at);
    if (a.mcp_url) kv('mcp url', a.mcp_url);
    info('');
  }
  return 0;
}

function pickFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}
