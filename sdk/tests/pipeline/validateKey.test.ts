import { validate } from '../../src/pipeline/validateKey';
import * as client from '../../src/http/client';
import * as jwtCache from '../../src/cache/jwtCache';

const BASE_PARAMS = {
  agentId: '00000000-0000-0000-0000-000000000001',
  apiSecret: 'test-secret-key',
  action: 'send_message',
  platform: 'mcp',
  platformApiUrl: 'https://api.example.com',
};

describe('validate', () => {
  let postSpy: jest.SpyInstance;
  let getCacheSpy: jest.SpyInstance;
  let setCacheSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(client, 'post');
    getCacheSpy = jest.spyOn(jwtCache, 'getCachedToken').mockReturnValue(null);
    setCacheSpy = jest.spyOn(jwtCache, 'setCachedToken').mockImplementation(() => {});
  });

  afterEach(() => {
    postSpy.mockRestore();
    getCacheSpy.mockRestore();
    setCacheSpy.mockRestore();
  });

  it('returns allowed: true when server responds with allowed and token', async () => {
    postSpy.mockResolvedValue({ allowed: true, token: 'jwt.token.here', expiresAt: '2099-01-01T00:05:00.000Z' });

    const result = await validate(BASE_PARAMS);

    expect(result.allowed).toBe(true);
    expect(result.token).toBe('jwt.token.here');
  });

  it('returns allowed: false when server denies the request', async () => {
    postSpy.mockResolvedValue({ allowed: false });

    const result = await validate(BASE_PARAMS);

    expect(result.allowed).toBe(false);
  });

  it('sends HMAC signature fields in the request body', async () => {
    postSpy.mockResolvedValue({ allowed: true, token: 'tok', expiresAt: '2099-01-01T00:05:00.000Z' });

    await validate(BASE_PARAMS);

    const sentBody = postSpy.mock.calls[0][1];
    expect(sentBody.agentId).toBe(BASE_PARAMS.agentId);
    expect(sentBody.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(sentBody.nonce).toHaveLength(64); // 32 bytes hex
    expect(sentBody.action).toBe('send_message');
    expect(sentBody.platform).toBe('mcp');
    expect(sentBody.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('calls the correct platform API URL', async () => {
    postSpy.mockResolvedValue({ allowed: true, token: 't', expiresAt: '2099-01-01T00:05:00.000Z' });

    await validate({ ...BASE_PARAMS, platformApiUrl: 'https://custom.example.com' });

    expect(postSpy.mock.calls[0][0]).toBe('https://custom.example.com/api/validate');
  });

  it('skips HTTP call and returns cached token when cache is warm', async () => {
    getCacheSpy.mockReturnValue('cached.jwt.token');

    const result = await validate(BASE_PARAMS);

    expect(result.allowed).toBe(true);
    expect(result.token).toBe('cached.jwt.token');
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('caches the token after a successful auth', async () => {
    postSpy.mockResolvedValue({ allowed: true, token: 'fresh.jwt', expiresAt: '2099-01-01T00:05:00.000Z' });

    await validate(BASE_PARAMS);

    expect(setCacheSpy).toHaveBeenCalledWith(BASE_PARAMS.agentId, 'fresh.jwt', '2099-01-01T00:05:00.000Z');
  });

  it('does not cache token when server returns allowed: false', async () => {
    postSpy.mockResolvedValue({ allowed: false });

    await validate(BASE_PARAMS);

    expect(setCacheSpy).not.toHaveBeenCalled();
  });

  it('propagates network errors from http client', async () => {
    postSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(validate(BASE_PARAMS)).rejects.toThrow('ECONNREFUSED');
  });
});
