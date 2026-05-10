import { apiRequest, APIError } from '../api';
import { loadConfig, saveConfig } from '../config';
import { ok, err, info, dim, kv } from '../util/print';
import { prompt, promptHidden } from '../util/prompt';

interface SessionResponse {
  token: string;
  userId: string;
  displayName: string;
  kycStatus?: string;
}

export async function login(args: string[]): Promise<number> {
  const flagToken = pickFlag(args, '--token');
  const flagUrl = pickFlag(args, '--url');

  const existing = loadConfig();
  const apiUrl = (flagUrl ?? existing.apiUrl).replace(/\/$/, '');

  info(dim(`Logging in to ${apiUrl}`));
  info(dim('Open the dashboard, copy your CLI token, and paste it here.'));
  info('');

  let token = flagToken;
  if (!token) {
    token = await promptHidden('CLI token: ');
  }
  if (!token) {
    err('No token provided.');
    return 1;
  }

  let session: SessionResponse;
  try {
    session = await apiRequest<SessionResponse>('/api/auth/session', {
      token,
      apiUrl,
    });
  } catch (e) {
    if (e instanceof APIError && e.status === 401) {
      err('Token rejected by the server.');
    } else if (e instanceof APIError) {
      err(e.message);
    } else {
      err(String(e));
    }
    return 1;
  }

  saveConfig({
    apiUrl,
    token,
    userId: session.userId,
    displayName: session.displayName,
  });

  ok(`Signed in as ${session.displayName}`);
  kv('user', session.userId);
  kv('endpoint', apiUrl);
  return 0;
}

function pickFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}
