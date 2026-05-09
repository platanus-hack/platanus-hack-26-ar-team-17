import { validate } from '../../src/pipeline/validateKey';
import * as client from '../../src/http/client';

jest.mock('../../src/http/client');

describe('validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the platform API allowed result', async () => {
    (client.post as jest.Mock).mockResolvedValue({ allowed: true });

    const result = await validate({
      token: 'ak_validkey',
      hash: 'user_hash_1',
      action: 'send_message',
      platform: 'whatsapp',
      platformApiUrl: 'https://api.example.com',
    });

    expect(result.allowed).toBe(true);
  });

  it('sends the payload expected by /api/validate', async () => {
    (client.post as jest.Mock).mockResolvedValue({ allowed: true });

    await validate({
      token: 'ak_plainkey123',
      hash: 'user_hash_1',
      action: 'send_message',
      platform: 'whatsapp',
      platformApiUrl: 'https://api.example.com',
    });

    expect(client.post).toHaveBeenCalledWith(
      'https://api.example.com/api/validate',
      {
        token: 'ak_plainkey123',
        hash: 'user_hash_1',
        action: 'send_message',
        platform: 'whatsapp',
      }
    );
  });

  it('propagates network errors from http client', async () => {
    (client.post as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      validate({
        token: 'ak_x',
        hash: 'user_hash_1',
        action: 'send_message',
        platform: 'whatsapp',
        platformApiUrl: 'https://api.example.com',
      })
    ).rejects.toThrow('ECONNREFUSED');
  });

  it('keeps action normalization to the caller', async () => {
    (client.post as jest.Mock).mockResolvedValue({ allowed: true });

    await validate({
      token: 'ak_x',
      hash: 'user_hash_1',
      action: 'SEND_MESSAGE',
      platform: 'whatsapp',
      platformApiUrl: 'https://api.example.com',
    });

    expect((client.post as jest.Mock).mock.calls[0][1].action).toBe('SEND_MESSAGE');
  });

  it('supports a platform API URL with a path prefix', async () => {
    (client.post as jest.Mock).mockResolvedValue({ allowed: false });

    await validate({
      token: 'ak_x',
      hash: 'user_hash_1',
      action: 'send_message',
      platform: 'whatsapp',
      platformApiUrl: 'https://api.example.com/v1',
    });

    expect((client.post as jest.Mock).mock.calls[0][0]).toBe('https://api.example.com/v1/api/validate');
  });
});
