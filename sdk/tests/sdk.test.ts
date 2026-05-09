import { ZeroGateSDK } from '../src/index';
import * as client from '../src/http/client';

jest.mock('../src/http/client');

describe('ZeroGateSDK.run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ZERO_API_KEY;
    delete process.env.ZERO_USER_HASH;
    delete process.env.ZERO_PLATFORM;
  });

  it('returns allowed: true for a valid request', async () => {
    (client.post as jest.Mock).mockResolvedValue({ allowed: true });

    const sdk = new ZeroGateSDK({ apiKey: 'ak_validkey', userHash: 'user_hash_1' });
    const result = await sdk.run();

    expect(result.allowed).toBe(true);
    expect(client.post).toHaveBeenCalledWith(
      'https://next-app-ochre-zeta.vercel.app/api/validate',
      expect.objectContaining({
        token: 'ak_validkey',
        hash: 'user_hash_1',
        action: expect.any(String),
        platform: expect.any(String),
      })
    );
  });

  it('returns allowed: false for a denied request', async () => {
    (client.post as jest.Mock).mockResolvedValue({ allowed: false });

    const sdk = new ZeroGateSDK({ apiKey: 'ak_badkey', userHash: 'user_hash_1' });
    const result = await sdk.run();

    expect(result.allowed).toBe(false);
  });

  it('reads credentials and platform from environment variables', async () => {
    process.env.ZERO_API_KEY = 'ak_env';
    process.env.ZERO_USER_HASH = 'hash_env';
    process.env.ZERO_PLATFORM = 'whatsapp';
    (client.post as jest.Mock).mockResolvedValue({ allowed: true });

    const sdk = new ZeroGateSDK();
    await sdk.run();

    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        token: 'ak_env',
        hash: 'hash_env',
        platform: 'whatsapp',
      })
    );
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
});
