import { ZeroGateSDK } from '../src/index';
import * as client from '../src/http/client';
import { PLATFORM_API_URL } from '../src/platform/detect';

describe('ZeroGateSDK.run', () => {
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(client, 'post');
    delete process.env.ZERO_API_KEY;
    delete process.env.ZERO_USER_HASH;
    delete process.env.ZERO_PLATFORM;
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  it('returns allowed: true for a valid request', async () => {
    postSpy.mockResolvedValue({ allowed: true });

    const sdk = new ZeroGateSDK({ apiKey: 'ak_validkey', userHash: 'user_hash_1' });
    const result = await sdk.run();

    expect(result.allowed).toBe(true);
    expect(postSpy).toHaveBeenCalledWith(
      `${PLATFORM_API_URL}/api/validate`,
      expect.objectContaining({
        token: 'ak_validkey',
        hash: 'user_hash_1',
        action: expect.any(String),
        platform: expect.any(String),
      })
    );
  });

  it('returns allowed: false for a denied request', async () => {
    postSpy.mockResolvedValue({ allowed: false });

    const sdk = new ZeroGateSDK({ apiKey: 'ak_badkey', userHash: 'user_hash_1' });
    const result = await sdk.run();

    expect(result.allowed).toBe(false);
  });

  it('reads credentials from environment variables', async () => {
    process.env.ZERO_API_KEY = 'ak_env';
    process.env.ZERO_USER_HASH = 'hash_env';
    postSpy.mockResolvedValue({ allowed: true });

    const sdk = new ZeroGateSDK();
    await sdk.run();

    expect(postSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        token: 'ak_env',
        hash: 'hash_env',
      })
    );
  });

  it('propagates network errors from the http client', async () => {
    postSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const sdk = new ZeroGateSDK({ apiKey: 'ak_testkey123', userHash: 'testhash456' });
    await expect(sdk.run()).rejects.toThrow('ECONNREFUSED');
  });
});

describe('ZeroGateSDK constructor', () => {
  beforeEach(() => {
    delete process.env.ZERO_API_KEY;
    delete process.env.ZERO_USER_HASH;
  });

  it('throws when apiKey is missing', () => {
    expect(() => new ZeroGateSDK({ userHash: 'hash' })).toThrow('Missing apiKey');
  });

  it('throws when userHash is missing', () => {
    expect(() => new ZeroGateSDK({ apiKey: 'ak_key' })).toThrow('Missing userHash');
  });

  it('throws when no config and env vars are absent', () => {
    expect(() => new ZeroGateSDK()).toThrow();
  });

  it('reads credentials from ZERO_API_KEY and ZERO_USER_HASH', () => {
    process.env.ZERO_API_KEY = 'ak_fromenv';
    process.env.ZERO_USER_HASH = 'hashfromenv';
    expect(new ZeroGateSDK()).toBeDefined();
  });
});
