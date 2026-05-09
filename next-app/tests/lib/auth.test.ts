import { NextRequest } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { issueUserToken } from '@/lib/services/token.service';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

function reqWith({ header, cookie }: { header?: string; cookie?: string }) {
  const headers: Record<string, string> = {};
  if (header) headers['Authorization'] = `Bearer ${header}`;
  if (cookie) headers['cookie'] = `${APP_SESSION_COOKIE}=${cookie}`;
  return new NextRequest('http://localhost/x', { headers });
}

describe('getAuthUserId', () => {
  it('returns userId from a valid Bearer token', async () => {
    const token = await issueUserToken('user_alpha');
    expect(getAuthUserId(reqWith({ header: token }))).toBe('user_alpha');
  });

  it('returns userId from a valid app_session cookie when no header is set', async () => {
    const token = await issueUserToken('user_beta');
    expect(getAuthUserId(reqWith({ cookie: token }))).toBe('user_beta');
  });

  it('prefers the Authorization header when both are present', async () => {
    const headerToken = await issueUserToken('user_header');
    const cookieToken = await issueUserToken('user_cookie');
    expect(getAuthUserId(reqWith({ header: headerToken, cookie: cookieToken }))).toBe('user_header');
  });

  it('returns null when neither is set', () => {
    expect(getAuthUserId(reqWith({}))).toBeNull();
  });

  it('returns null for an invalid cookie value', () => {
    expect(getAuthUserId(reqWith({ cookie: 'not-a-jwt' }))).toBeNull();
  });
});
