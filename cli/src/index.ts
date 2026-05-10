#!/usr/bin/env node
import { login } from './commands/login';
import { logout } from './commands/logout';
import { whoami } from './commands/whoami';
import { agents } from './commands/agents';
import { init } from './commands/init';
import { bold, dim, err, info } from './util/print';

const VERSION = '0.1.0';

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const rest = argv.slice(1);

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return 0;
  }

  if (cmd === '--version' || cmd === '-v') {
    info(VERSION);
    return 0;
  }

  switch (cmd) {
    case 'login':
      return login(rest);
    case 'logout':
      return logout();
    case 'whoami':
      return whoami();
    case 'agents':
      return agents(rest);
    case 'init':
      return init(rest);
    default:
      err(`Unknown command: ${cmd}`);
      info('');
      printHelp();
      return 1;
  }
}

function printHelp(): void {
  info(`${bold('zero')} ${dim(`v${VERSION}`)} — Zero Gate developer CLI

${bold('Usage')}
  zero <command> [...flags]

${bold('Commands')}
  login              Sign in with a CLI token from the dashboard
  logout             Remove local credentials
  whoami             Show the current signed-in user
  init               Add @zero-gate/sdk to the current project
  agents create      Create an agent and print credentials
  agents list        List your agents

${bold('Environment')}
  ZEROGATE_URL       Override the API URL (default http://localhost:3000)
  ZEROGATE_TOKEN     Override the stored CLI token (useful in CI)

${bold('Examples')}
  zero login
  zero agents create my-bot --platform slack
  ZEROGATE_URL=https://zero.example.com zero whoami
`);
}

main().then(
  code => process.exit(code),
  e => {
    err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
