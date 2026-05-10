import { getCachedToken, setCachedToken, clearCache } from '../../src/auth/cache';

beforeEach(() => clearCache());

describe('getCachedToken', () => {
  it('returns null when cache is empty', () => {
    expect(getCachedToken()).toBeNull();
  });

  it('returns the token when not expired', () => {
    const future = new Date(Date.now() + 300_000).toISOString(); // 5 min from now
    setCachedToken('my-token', future);
    expect(getCachedToken()).toBe('my-token');
  });

  it('returns null when token is expired', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    setCachedToken('old-token', past);
    expect(getCachedToken()).toBeNull();
  });

  it('returns null within the 30-second buffer window', () => {
    // 20 seconds until expiry — within the 30s safety buffer
    const almostExpired = new Date(Date.now() + 20_000).toISOString();
    setCachedToken('near-expiry', almostExpired);
    expect(getCachedToken()).toBeNull();
  });

  it('returns token when more than 30 seconds remain', () => {
    const valid = new Date(Date.now() + 60_000).toISOString();
    setCachedToken('valid-token', valid);
    expect(getCachedToken()).toBe('valid-token');
  });
});

describe('clearCache', () => {
  it('clears a valid cached token', () => {
    const future = new Date(Date.now() + 300_000).toISOString();
    setCachedToken('to-clear', future);
    clearCache();
    expect(getCachedToken()).toBeNull();
  });
});
