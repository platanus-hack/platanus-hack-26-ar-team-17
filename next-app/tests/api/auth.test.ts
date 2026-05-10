import { POST as login, DELETE as logout } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));
jest.mock('@/lib/services/profile.service', () => ({
  getProfileByUserId: jest.fn(),
  createProfile: jest.fn(),
  updateProfileFromKycResult: jest.fn(),
}));
jest.mock('@/lib/services/loginAttempt.service', () => ({
  createPendingLoginAttempt: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/didit.service', () => ({
  createVerificationSession: jest.fn(),
  getKycPortraitAsBase64: jest.fn(),
}));
jest.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/lib/services/token.service', () => ({
  issueUserToken: jest.fn().mockResolvedValue('mock.user.token'),
  revokeToken: jest.fn().mockResolvedValue(undefined),
  verifyToken: jest.fn(),
}));

const { supabase } = require('@/lib/db/supabase');
const { getProfileByUserId, createProfile } = require('@/lib/services/profile.service');
const { createVerificationSession, getKycPortraitAsBase64 } = require('@/lib/services/didit.service');
const { checkRateLimit } = require('@/lib/rateLimiter');
const { revokeToken, verifyToken } = require('@/lib/services/token.service');

beforeEach(() => jest.clearAllMocks());

function makePost(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const googleUser = {
  id: 'auth_user_1',
  email: 'a@b.com',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Ada Lovelace', avatar_url: 'https://x/y.png', sub: 'gsub' },
};

describe('POST /api/auth/login', () => {
  const profile = { id: 'p1', user_id: 'auth_user_1', verification_status: 'APPROVED', didit_kyc_session_id: 'sess_kyc_1' };

  it('starts KYC and returns 201 for a new (unregistered) user', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(null);
    createVerificationSession.mockResolvedValueOnce({ session_id: 'sess_kyc_1', url: 'https://verify/sess_kyc_1' });
    createProfile.mockResolvedValueOnce({ id: 'p1' });

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.verification_url).toBe('https://verify/sess_kyc_1');
    expect(body.session_id).toBe('sess_kyc_1');
    expect(createVerificationSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'auth_user_1',
      callbackUrl: expect.stringContaining('/auth/didit-callback'),
    }));
    expect(createProfile).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'auth_user_1',
      didit_kyc_session_id: 'sess_kyc_1',
      dni: null,
    }));
  });

  it('creates a Didit Biometric session for an approved user', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(profile);
    getKycPortraitAsBase64.mockResolvedValueOnce('base64encodedportrait');
    createVerificationSession.mockResolvedValueOnce({ session_id: 'sess_bio_1', url: 'https://verify/sess_bio_1' });

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.verification_url).toBe('https://verify/sess_bio_1');
    expect(createVerificationSession).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'auth_user_1',
      callbackUrl: expect.stringContaining('/auth/didit-callback'),
    }));
  });

  it('returns 409 when verification is still PENDING', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ ...profile, verification_status: 'PENDING' });
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(409);
  });

  it('returns 429 when rate-limited', async () => {
    checkRateLimit.mockResolvedValueOnce(false);
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(429);
  });

  it('returns 401 when Supabase token is invalid', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } });
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'bad' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when provider is not google', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { ...googleUser, app_metadata: { provider: 'email' } } }, error: null,
    });
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/auth/login', () => {
  it('revokes JWT and clears cookie', async () => {
    verifyToken.mockResolvedValueOnce({ jti: 'jti_1' });
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'DELETE',
      headers: { cookie: `${APP_SESSION_COOKIE}=tok` },
    });
    const res = await logout(req);
    expect(res.status).toBe(200);
    expect(revokeToken).toHaveBeenCalledWith('jti_1');
    expect(res.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i);
  });

  it('is idempotent without cookie', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', { method: 'DELETE' });
    const res = await logout(req);
    expect(res.status).toBe(200);
    expect(revokeToken).not.toHaveBeenCalled();
  });
});
