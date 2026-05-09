import { post } from '../../src/http/client';
import https from 'https';

jest.mock('https');

describe('http client', () => {
  it('always uses https, never http', () => {
    const mockReq = { on: jest.fn(), write: jest.fn(), end: jest.fn() };
    (https.request as jest.Mock).mockReturnValue(mockReq);

    post('https://api.example.com/v1/validate', { token: 'ak_valid', hash: 'hash_valid' });

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

  it('uses hostname, port, and full path from URL', () => {
    const mockReq = { on: jest.fn(), write: jest.fn(), end: jest.fn() };
    (https.request as jest.Mock).mockReturnValue(mockReq);

    post('https://api.example.com:8443/api/validate?v=2', {});

    expect(https.request).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: 'api.example.com',
        port: '8443',
        path: '/api/validate?v=2',
      }),
      expect.any(Function)
    );
  });

  it('rejects with "Invalid JSON" when server returns non-JSON body', async () => {
    const mockReq = { on: jest.fn(), write: jest.fn(), end: jest.fn() };
    (https.request as jest.Mock).mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      setImmediate(() => {
        cb({
          on: (event: string, handler: (...args: unknown[]) => void) => {
            if (event === 'data') handler('not-json-at-all');
            if (event === 'end') handler();
          },
        });
      });
      return mockReq;
    });

    await expect(
      post('https://api.example.com/api/validate', {})
    ).rejects.toThrow('Invalid JSON');
  });

  it('propagates network errors from the underlying request', async () => {
    const mockReq = {
      on: jest.fn((event: string, handler: (err: Error) => void) => {
        if (event === 'error') setImmediate(() => handler(new Error('ECONNREFUSED')));
      }),
      write: jest.fn(),
      end: jest.fn(),
    };
    (https.request as jest.Mock).mockReturnValue(mockReq);

    await expect(
      post('https://api.example.com/api/validate', {})
    ).rejects.toThrow('ECONNREFUSED');
  });
});
