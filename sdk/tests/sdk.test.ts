import { AgentAuthSDK } from '../src/index';
import * as client from '../src/http/client';

jest.mock('../src/http/client');

const sdk = new AgentAuthSDK({ platformApiUrl: 'https://api.example.com' });

describe('AgentAuthSDK.run', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns allowed: true for a valid request', async () => {
    (client.post as jest.Mock).mockResolvedValue({
      valid: true,
      token: 'jwt.token.here',
      userId: 'user_1',
      scope: ['send_message'],
    });

    const result = await sdk.run({
      apiKey: 'ak_validkey',
      action: 'send_message',
      platform: 'whatsapp',
      text: 'Hello',
    });

    expect(result.allowed).toBe(true);
    expect(result.token).toBe('jwt.token.here');
  });

  it('returns allowed: false for an invalid key', async () => {
    (client.post as jest.Mock).mockResolvedValue({ valid: false, error: 'invalid_api_key' });

    const result = await sdk.run({
      apiKey: 'ak_badkey',
      action: 'send_message',
      platform: 'whatsapp',
      text: '',
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('invalid_api_key');
  });

  it('returns allowed: false when action is blocked by rules', async () => {
    (client.post as jest.Mock).mockResolvedValue({
      valid: false,
      error: 'action_not_permitted',
    });

    const result = await sdk.run({
      apiKey: 'ak_validkey',
      action: 'mass_send',
      platform: 'whatsapp',
      text: 'spam',
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('action_not_permitted');
  });

  it('returns allowed: false when action is out of scope', async () => {
    (client.post as jest.Mock).mockResolvedValue({
      valid: true,
      token: 'jwt',
      userId: 'user_1',
      scope: ['read_messages'],
    });

    const result = await sdk.run({
      apiKey: 'ak_validkey',
      action: 'send_message',
      platform: 'whatsapp',
      text: 'hello',
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe('action_not_permitted');
  });
});
