import { ZeroGateSDK } from '../src/index';
import * as client from '../src/http/client';
import * as authCache from '../src/auth/cache';
import { PLATFORM_API_URL } from '../src/platform/detect';

const AGENT_ID = '00000000-0000-0000-0000-000000000001';
const API_SECRET = 'test-api-secret-value';

describe('ZeroGateSDK.run — HMAC mode', () => {
  let postSpy: jest.SpyInstance;
  let getCacheSpy: jest.SpyInstance;
  let setCacheSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(client, 'post');
    getCacheSpy = jest.spyOn(authCache, 'getCachedToken').mockReturnValue(null);
    setCacheSpy = jest.spyOn(authCache, 'setCachedToken').mockImplementation(() => {});
    delete process.env.ZERO_AGENT_ID;
    delete process.env.ZERO_API_SECRET;
  });

  afterEach(() => {
    postSpy.mockRestore();
    getCacheSpy.mockRestore();
    setCacheSpy.mockRestore();
  });

  it('returns allowed: true for a valid request', async () => {
    postSpy.mockResolvedValue({ allowed: true, token: 'jwt', expiresAt: '2099-01-01T00:05:00.000Z' });

    const sdk = new ZeroGateSDK({ agentId: AGENT_ID, apiSecret: API_SECRET });
    const result = await sdk.run();
    expect(result.allowed).toBe(true);
    expect(postSpy).toHaveBeenCalledWith(
      `${PLATFORM_API_URL}/api/validate`,
      expect.objectContaining({
        agentId: AGENT_ID,
        action: expect.any(String),
        platform: expect.any(String),
        nonce: expect.any(String),
        timestamp: expect.any(String),
        signature: expect.any(String),
      })
    );
  });

  it('returns allowed: false for a denied request', async () => {
    postSpy.mockResolvedValue({ allowed: false });

    const sdk = new ZeroGateSDK({ agentId: AGENT_ID, apiSecret: API_SECRET });
    const result = await sdk.run();
    expect(result.allowed).toBe(false);
  });

  it('reads credentials from environment variables', async () => {
    process.env.ZERO_AGENT_ID = AGENT_ID;
    process.env.ZERO_API_SECRET = API_SECRET;
    postSpy.mockResolvedValue({ allowed: true, token: 'jwt', expiresAt: '2099-01-01T00:05:00.000Z' });

    const sdk = new ZeroGateSDK();
    await sdk.run();

    expect(postSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ agentId: AGENT_ID })
    );
  });

  it('reuses cached JWT without making an HTTP call', async () => {
    getCacheSpy.mockReturnValue('cached.token');

    const sdk = new ZeroGateSDK({ agentId: AGENT_ID, apiSecret: API_SECRET });
    const result = await sdk.run();

    expect(result.allowed).toBe(true);
    expect(result.token).toBe('cached.token');
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('propagates network errors from the http client', async () => {
    postSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const sdk = new ZeroGateSDK({ agentId: AGENT_ID, apiSecret: API_SECRET });
    await expect(sdk.run()).rejects.toThrow('ECONNREFUSED');
  });
});

describe('ZeroGateSDK constructor', () => {
  beforeEach(() => {
    delete process.env.ZERO_AGENT_ID;
    delete process.env.ZERO_API_SECRET;
    delete process.env.ZERO_PRIVATE_KEY;
  });

  it('throws when agentId is missing', () => {
    expect(() => new ZeroGateSDK({ apiSecret: API_SECRET })).toThrow();
  });

  it('throws when apiSecret is missing and no privateKey', () => {
    expect(() => new ZeroGateSDK({ agentId: AGENT_ID })).toThrow();
  });

  it('throws when no config and env vars are absent', () => {
    expect(() => new ZeroGateSDK()).toThrow();
  });

  it('accepts agentId + apiSecret for HMAC mode', () => {
    expect(() => new ZeroGateSDK({ agentId: AGENT_ID, apiSecret: API_SECRET })).not.toThrow();
  });

  it('accepts agentId + privateKey for Ed25519 mode', () => {
    expect(() => new ZeroGateSDK({ agentId: AGENT_ID, privateKey: 'a'.repeat(64) })).not.toThrow();
  });

  it('reads credentials from ZERO_AGENT_ID and ZERO_API_SECRET', () => {
    process.env.ZERO_AGENT_ID = AGENT_ID;
    process.env.ZERO_API_SECRET = API_SECRET;
    expect(new ZeroGateSDK()).toBeDefined();
  });
});

describe('ZeroGateSDK.run — Ed25519 mode', () => {
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(client, 'post');
    authCache.clearCache();
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  it('calls challenge and verify endpoints and returns allowed: true with token', async () => {
    postSpy
      .mockResolvedValueOnce({
        challengeId: 'chal-1',
        nonce: 'nonce-abc',
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
      .mockResolvedValueOnce({
        accessToken: 'jwt-access-token',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });

    const edSdk = new ZeroGateSDK({ agentId: AGENT_ID, privateKey: 'a'.repeat(64) });
    const result = await edSdk.run();
    expect(result.allowed).toBe(true);
    expect(result.token).toBe('jwt-access-token');
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('uses a cached token on the second call (no extra network requests)', async () => {
    authCache.clearCache();

    postSpy
      .mockResolvedValueOnce({
        challengeId: 'c',
        nonce: 'n',
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      })
      .mockResolvedValueOnce({
        accessToken: 'tok',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });

    const edSdk = new ZeroGateSDK({ agentId: AGENT_ID, privateKey: 'a'.repeat(64) });
    await edSdk.run();

    postSpy.mockClear();
    const result2 = await edSdk.run();
    expect(postSpy).not.toHaveBeenCalled();
    expect(result2.allowed).toBe(true);
    expect(result2.token).toBe('tok');
  });
});
