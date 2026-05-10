interface CacheEntry {
  token: string;
  expiresAt: number; // unix ms
}

const cache = new Map<string, CacheEntry>();

const BUFFER_MS = 30_000; // refresh 30s before actual expiry

export function getCachedToken(agentId: string): string | null {
  const entry = cache.get(agentId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt - BUFFER_MS) {
    cache.delete(agentId);
    return null;
  }
  return entry.token;
}

export function setCachedToken(agentId: string, token: string, expiresAt: string): void {
  cache.set(agentId, { token, expiresAt: new Date(expiresAt).getTime() });
}

export function clearCachedToken(agentId: string): void {
  cache.delete(agentId);
}
