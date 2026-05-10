import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { issueUserToken, isTokenRevoked } from '@/lib/services/token.service';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

jest.mock('@/lib/services/token.service', () => ({
  ...jest.requireActual('@/lib/services/token.service'),
  isTokenRevoked: jest.fn(),
}));

function reqWith({ header, cookie }: { header?: string; cookie?: string }) {
  const headers: Record<string, string> = {};
  if (header) headers['Authorization'] = `Bearer ${header}`;
  if (cookie) headers['cookie'] = `${APP_SESSION_COOKIE}=${cookie}`;
  return new NextRequest('http://localhost/x', { headers });
}

const mockedIsTokenRevoked = isTokenRevoked as jest.MockedFunction<typeof isTokenRevoked>;

describe('getAuthUserId', () => {
  beforeEach(() => {
    mockedIsTokenRevoked.mockResolvedValue(false);
  });

  it('returns userId from a valid Bearer token', async () => {
    const token = await issueUserToken('user_alpha');
    await expect(getAuthUserId(reqWith({ header: token }))).resolves.toBe('user_alpha');
  });

  it('returns userId from a valid app_session cookie when no header is set', async () => {
    const token = await issueUserToken('user_beta');
    await expect(getAuthUserId(reqWith({ cookie: token }))).resolves.toBe('user_beta');
  });

  it('prefers the Authorization header when both are present', async () => {
    const headerToken = await issueUserToken('user_header');
    const cookieToken = await issueUserToken('user_cookie');
    await expect(getAuthUserId(reqWith({ header: headerToken, cookie: cookieToken }))).resolves.toBe(
      'user_header',
    );
  });

  it('returns null when neither is set', async () => {
    await expect(getAuthUserId(reqWith({}))).resolves.toBeNull();
  });

  it('returns null for an invalid cookie value', async () => {
    await expect(getAuthUserId(reqWith({ cookie: 'not-a-jwt' }))).resolves.toBeNull();
  });

  it('returns null when the session jti is revoked', async () => {
    mockedIsTokenRevoked.mockResolvedValueOnce(true);
    const token = await issueUserToken('user_revoked');
    await expect(getAuthUserId(reqWith({ header: token }))).resolves.toBeNull();
  });
});
