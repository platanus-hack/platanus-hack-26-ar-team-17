import { validateKeyAndGetToken } from '../../src/pipeline/validateKey';
import * as client from '../../src/http/client';

jest.mock('../../src/http/client');

describe('validateKeyAndGetToken', () => {
  it('returns token and userId for a valid key', async () => {
    (client.post as jest.Mock).mockResolvedValue({
      valid: true,
      token: 'jwt.token.here',
      userId: 'user_1',
      scope: ['send_message'],
    });

    const result = await validateKeyAndGetToken({
      apiKey: 'ak_validkey',
      action: 'send_message',
      platform: 'whatsapp',
      text: 'hello',
      platformApiUrl: 'https://api.example.com',
    });

    expect(result.valid).toBe(true);
    expect(result.token).toBe('jwt.token.here');
    expect(result.userId).toBe('user_1');
  });

  it('returns invalid for an unknown key', async () => {
    (client.post as jest.Mock).mockResolvedValue({ valid: false, error: 'invalid_api_key' });

    const result = await validateKeyAndGetToken({
      apiKey: 'ak_badkey',
      action: 'send_message',
      platform: 'whatsapp',
      text: '',
      platformApiUrl: 'https://api.example.com',
    });

    expect(result.valid).toBe(false);
  });

  it('hashes the api key before sending — never sends plain key', async () => {
    (client.post as jest.Mock).mockResolvedValue({ valid: true, token: 't', userId: 'u', scope: [] });

    await validateKeyAndGetToken({
      apiKey: 'ak_plainkey123',
      action: 'send_message',
      platform: 'whatsapp',
      text: '',
      platformApiUrl: 'https://api.example.com',
    });

    const sentBody = (client.post as jest.Mock).mock.calls[0][1];
    expect(sentBody.api_key_hash).not.toBe('ak_plainkey123');
    expect(sentBody.api_key_hash).not.toContain('ak_');
  });
});
