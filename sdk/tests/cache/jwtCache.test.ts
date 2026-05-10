import { getCachedToken, setCachedToken, clearCachedToken } from '../../src/cache/jwtCache';

const AGENT_ID = 'test-agent-id';
const FAR_FUTURE = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min from now
const PAST = new Date(Date.now() - 1000).toISOString(); // 1 sec ago

describe('jwtCache', () => {
  beforeEach(() => {
    clearCachedToken(AGENT_ID);
  });

  describe('getCachedToken', () => {
    it('returns null when no token is cached', () => {
      expect(getCachedToken(AGENT_ID)).toBeNull();
    });

    it('returns the cached token when it is valid', () => {
      setCachedToken(AGENT_ID, 'my.jwt.token', FAR_FUTURE);
      expect(getCachedToken(AGENT_ID)).toBe('my.jwt.token');
    });

    it('returns null for an already-expired token', () => {
      setCachedToken(AGENT_ID, 'expired.token', PAST);
      expect(getCachedToken(AGENT_ID)).toBeNull();
    });

    it('returns null when the token is within the 30s refresh buffer', () => {
      const almostExpired = new Date(Date.now() + 20_000).toISOString(); // expires in 20s (< 30s buffer)
      setCachedToken(AGENT_ID, 'soon.expired', almostExpired);
      expect(getCachedToken(AGENT_ID)).toBeNull();
    });
  });

  describe('setCachedToken', () => {
    it('overwrites a previous token for the same agentId', () => {
      setCachedToken(AGENT_ID, 'token-v1', FAR_FUTURE);
      setCachedToken(AGENT_ID, 'token-v2', FAR_FUTURE);
      expect(getCachedToken(AGENT_ID)).toBe('token-v2');
    });

    it('caches independently for different agentIds', () => {
      setCachedToken('agent-a', 'token-a', FAR_FUTURE);
      setCachedToken('agent-b', 'token-b', FAR_FUTURE);
      expect(getCachedToken('agent-a')).toBe('token-a');
      expect(getCachedToken('agent-b')).toBe('token-b');
    });
  });

  describe('clearCachedToken', () => {
    it('removes the cached token', () => {
      setCachedToken(AGENT_ID, 'my.jwt.token', FAR_FUTURE);
      clearCachedToken(AGENT_ID);
      expect(getCachedToken(AGENT_ID)).toBeNull();
    });

    it('is a no-op when no token is cached', () => {
      expect(() => clearCachedToken(AGENT_ID)).not.toThrow();
    });
  });
});
