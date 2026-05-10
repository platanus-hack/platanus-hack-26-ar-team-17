import { validate } from '../../src/pipeline/validateKey';
import * as client from '../../src/http/client';
import * as authCache from '../../src/auth/cache';

const BASE = {
  agentId:        '00000000-0000-0000-0000-000000000001',
  apiSecret:      'test-api-secret',
  action:         'send_message',
  platform:       'mcp',
  platformApiUrl: 'https://api.example.com',
};

describe('validate', () => {
  let postSpy: jest.SpyInstance;
  let getCacheSpy: jest.SpyInstance;
  let setCacheSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(client, 'post');
    getCacheSpy = jest.spyOn(authCache, 'getCachedToken').mockReturnValue(null);
    setCacheSpy = jest.spyOn(authCache, 'setCachedToken').mockImplementation(() => {});
  });

  afterEach(() => {
    postSpy.mockRestore();
    getCacheSpy.mockRestore();
    setCacheSpy.mockRestore();
  });

  it('returns allowed: true for a valid HMAC request', async () => {
    postSpy.mockResolvedValue({ allowed: true, token: 'jwt', expiresAt: '2099-01-01T00:05:00.000Z' });
    const result = await validate(BASE);
    expect(result.allowed).toBe(true);
  });

  it('returns allowed: false when the server rejects the request', async () => {
    postSpy.mockResolvedValue({ allowed: false });
    const result = await validate(BASE);
    expect(result.allowed).toBe(false);
  });

  it('sends agentId, timestamp, nonce, action, platform, signature in request body', async () => {
    postSpy.mockResolvedValue({ allowed: true });
    await validate(BASE);
    const sentBody = postSpy.mock.calls[0][1];
    expect(sentBody.agentId).toBe(BASE.agentId);
    expect(sentBody.action).toBe(BASE.action);
    expect(sentBody.platform).toBe(BASE.platform);
    expect(sentBody.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(sentBody.timestamp).toBeDefined();
    expect(sentBody.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('calls the correct platform API URL', async () => {
    postSpy.mockResolvedValue({ allowed: true });
    await validate(BASE);
    expect(postSpy.mock.calls[0][0]).toBe('https://api.example.com/api/validate');
  });

  it('propagates network errors from http client', async () => {
    postSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(validate(BASE)).rejects.toThrow('ECONNREFUSED');
  });

  it('keeps action normalization to the caller', async () => {
    postSpy.mockResolvedValue({ allowed: true });
    await validate({ ...BASE, action: 'SEND_MESSAGE' });
    expect(postSpy.mock.calls[0][1].action).toBe('SEND_MESSAGE');
  });

  it('supports a platform API URL with a path prefix', async () => {
    postSpy.mockResolvedValue({ allowed: false });
    await validate({ ...BASE, platformApiUrl: 'https://api.example.com/v1' });
    expect(postSpy.mock.calls[0][0]).toBe('https://api.example.com/v1/api/validate');
  });

  it('caches the token and skips the HTTP call on the second request', async () => {
    postSpy.mockResolvedValue({ allowed: true, token: 'cached-jwt', expiresAt: '2099-01-01T00:05:00.000Z' });
    await validate(BASE);
    expect(setCacheSpy).toHaveBeenCalledWith('cached-jwt', '2099-01-01T00:05:00.000Z');

    getCacheSpy.mockReturnValue('cached-jwt');
    postSpy.mockClear();
    const result2 = await validate(BASE);
    expect(postSpy).not.toHaveBeenCalled();
    expect(result2.token).toBe('cached-jwt');
  });
});
