interface CachedToken {
  token: string;
  expiresAt: number; // Unix ms
}

let cached: CachedToken | null = null;

// Return the cached token if it hasn't expired yet (with a 30s buffer).
export function getCachedToken(): string | null {
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt - 30_000) {
    cached = null;
    return null;
  }
  return cached.token;
}

export function setCachedToken(token: string, expiresAt: string): void {
  cached = { token, expiresAt: new Date(expiresAt).getTime() };
}

export function clearCache(): void {
  cached = null;
}
