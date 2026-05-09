import { validate } from '../../src/pipeline/validateKey';
import * as client from '../../src/http/client';

describe('validate', () => {
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    postSpy = jest.spyOn(client, 'post');
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  it('returns allowed: true for a valid key and hash', async () => {
    postSpy.mockResolvedValue({ allowed: true });

    const result = await validate({
      token: 'ak_validkey',
      hash: 'userhash123',
      action: 'send_message',
      platform: 'mcp',
      platformApiUrl: 'https://api.example.com',
    });

    expect(result.allowed).toBe(true);
  });

  it('returns allowed: false for an invalid key', async () => {
    postSpy.mockResolvedValue({ allowed: false });

    const result = await validate({
      token: 'ak_badkey',
      hash: 'userhash123',
      action: 'send_message',
      platform: 'mcp',
      platformApiUrl: 'https://api.example.com',
    });

    expect(result.allowed).toBe(false);
  });

  it('sends plain token and hash in request body', async () => {
    postSpy.mockResolvedValue({ allowed: true });

    await validate({
      token: 'ak_plainkey',
      hash: 'myhash',
      action: 'send_message',
      platform: 'mcp',
      platformApiUrl: 'https://api.example.com',
    });

    const sentBody = postSpy.mock.calls[0][1];
    expect(sentBody.token).toBe('ak_plainkey');
    expect(sentBody.hash).toBe('myhash');
    expect(sentBody.action).toBe('send_message');
    expect(sentBody.platform).toBe('mcp');
  });

  it('calls the correct platform API URL', async () => {
    postSpy.mockResolvedValue({ allowed: true });

    await validate({
      token: 'ak_x',
      hash: 'h',
      action: 'send_message',
      platform: 'mcp',
      platformApiUrl: 'https://custom.example.com',
    });

    expect(postSpy.mock.calls[0][0]).toBe('https://custom.example.com/api/validate');
  });

  it('propagates network errors from http client', async () => {
    postSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      validate({
        token: 'ak_x',
        hash: 'h',
        action: 'send_message',
        platform: 'mcp',
        platformApiUrl: 'https://api.example.com',
      })
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('keeps action normalization to the caller', async () => {
    postSpy.mockResolvedValue({ allowed: true });

    await validate({
      token: 'ak_x',
      hash: 'user_hash_1',
      action: 'SEND_MESSAGE',
      platform: 'mcp',
      platformApiUrl: 'https://api.example.com',
    });

    expect(postSpy.mock.calls[0][1].action).toBe('SEND_MESSAGE');
  });

  it('supports a platform API URL with a path prefix', async () => {
    postSpy.mockResolvedValue({ allowed: false });

    await validate({
      token: 'ak_x',
      hash: 'user_hash_1',
      action: 'send_message',
      platform: 'mcp',
      platformApiUrl: 'https://api.example.com/v1',
    });

    expect(postSpy.mock.calls[0][0]).toBe('https://api.example.com/v1/api/validate');
  });
});
