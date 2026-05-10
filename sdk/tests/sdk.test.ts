import { ZeroGateSDK } from '../src/index';
import * as client from '../src/http/client';
import * as jwtCache from '../src/cache/jwtCache';
import { PLATFORM_API_URL } from '../src/platform/detect';

const AGENT_ID = '00000000-0000-0000-0000-000000000001';
const API_SECRET = 'test-api-secret-value';

describe('ZeroGateSDK.run', () => {
  let postSpy: jest.SpyInstance;
  let getCacheSpy: jest.SpyInstance;
  let setCacheSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(client, 'post');
    getCacheSpy = jest.spyOn(jwtCache, 'getCachedToken').mockReturnValue(null);
    setCacheSpy = jest.spyOn(jwtCache, 'setCachedToken').mockImplementation(() => {});
    delete process.env.ZERO_AGENT_ID;
    delete process.env.ZERO_API_SECRET;
    delete process.env.ZERO_PLATFORM;
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
  });

  it('throws when agentId is missing', () => {
    expect(() => new ZeroGateSDK({ apiSecret: API_SECRET })).toThrow('Missing agentId');
  });

  it('throws when apiSecret is missing', () => {
    expect(() => new ZeroGateSDK({ agentId: AGENT_ID })).toThrow('Missing apiSecret');
  });

  it('throws when no config and env vars are absent', () => {
    expect(() => new ZeroGateSDK()).toThrow();
  });

  it('reads credentials from ZERO_AGENT_ID and ZERO_API_SECRET', () => {
    process.env.ZERO_AGENT_ID = AGENT_ID;
    process.env.ZERO_API_SECRET = API_SECRET;
    expect(new ZeroGateSDK()).toBeDefined();
  });
});
