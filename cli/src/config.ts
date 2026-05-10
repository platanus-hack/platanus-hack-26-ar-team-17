import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const DEFAULT_API_URL = 'http://localhost:3000';

export interface CLIConfig {
  apiUrl: string;
  token?: string;
  userId?: string;
  displayName?: string;
}

function configDir(): string {
  return path.join(os.homedir(), '.zero-gate');
}

function configFile(): string {
  return path.join(configDir(), 'config.json');
}

export function loadConfig(): CLIConfig {
  const file = configFile();
  let stored: Partial<CLIConfig> = {};
  if (fs.existsSync(file)) {
    try {
      stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      stored = {};
    }
  }
  const apiUrl =
    process.env.ZEROGATE_URL?.replace(/\/$/, '') ??
    stored.apiUrl ??
    DEFAULT_API_URL;

  return {
    apiUrl,
    token: process.env.ZEROGATE_TOKEN ?? stored.token,
    userId: stored.userId,
    displayName: stored.displayName,
  };
}

export function saveConfig(cfg: CLIConfig): void {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = configFile();
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows ignores chmod silently — fine.
  }
}

export function clearConfig(): void {
  const file = configFile();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function configPath(): string {
  return configFile();
}
