import { post } from '../../src/http/client';
import https from 'https';

jest.mock('https');

describe('http client', () => {
  it('always uses https, never http', () => {
    const mockReq = { on: jest.fn(), write: jest.fn(), end: jest.fn() };
    (https.request as jest.Mock).mockReturnValue(mockReq);

    post('https://api.example.com/v1/validate', { api_key_hash: 'abc' });

    expect(https.request).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: 'https:',
        rejectUnauthorized: true,
      }),
      expect.any(Function)
    );
  });

  it('throws if a non-https url is provided', async () => {
    await expect(
      post('http://api.example.com/v1/validate', {})
    ).rejects.toThrow('HTTPS required');
  });
});
