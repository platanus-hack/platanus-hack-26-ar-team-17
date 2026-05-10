import { apiRequest, APIError } from '../api';
import { loadConfig } from '../config';
import { err, kv, ok } from '../util/print';

export async function whoami(): Promise<number> {
  const cfg = loadConfig();
  if (!cfg.token) {
    err('Not signed in. Run `zero login` first.');
    return 1;
  }

  try {
    const session = await apiRequest<{ userId: string; displayName: string; kycStatus?: string }>(
      '/api/auth/session',
    );
    ok(`Signed in as ${session.displayName}`);
    kv('user', session.userId);
    kv('endpoint', cfg.apiUrl);
    if (session.kycStatus) kv('kyc', session.kycStatus);
    return 0;
  } catch (e) {
    if (e instanceof APIError && e.status === 401) {
      err('Session expired. Run `zero login` to sign in again.');
      return 1;
    }
    err(e instanceof Error ? e.message : String(e));
    return 1;
  }
}
