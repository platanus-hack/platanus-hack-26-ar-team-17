import { NextResponse } from 'next/server';
import { setSessionCookie, clearSessionCookie, APP_SESSION_COOKIE } from '@/lib/cookies';

describe('setSessionCookie', () => {
  it('sets an HttpOnly secure SameSite=Strict cookie with the JWT value', () => {
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, 'jwt.value.here');
    const cookie = res.cookies.get(APP_SESSION_COOKIE);
    expect(cookie?.value).toBe('jwt.value.here');
    const headerStr = res.headers.get('set-cookie') ?? '';
    expect(headerStr).toMatch(/HttpOnly/i);
    expect(headerStr).toMatch(/SameSite=Strict/i);
    expect(headerStr).toMatch(/Path=\//i);
  });
});

describe('clearSessionCookie', () => {
  it('emits a Max-Age=0 cookie on the response', () => {
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    const headerStr = res.headers.get('set-cookie') ?? '';
    expect(headerStr).toMatch(new RegExp(`${APP_SESSION_COOKIE}=`));
    expect(headerStr).toMatch(/Max-Age=0/i);
  });
});
