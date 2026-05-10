import { POST as login, DELETE as logout } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));
jest.mock('@/lib/services/profile.service', () => ({
  getProfileByUserId: jest.fn(),
  createProfile: jest.fn(),
  updateProfileFromKycResult: jest.fn().mockResolvedValue(undefined),
  getSessionFieldsForAuthUser: jest.fn().mockResolvedValue({ kycStatus: 'VERIFIED', displayName: 'Ada Lovelace' }),
}));
jest.mock('@/lib/services/didit.service', () => ({
  createVerificationSession: jest.fn(),
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
const { getProfileByUserId, createProfile, updateProfileFromKycResult } = require('@/lib/services/profile.service');
const { createVerificationSession } = require('@/lib/services/didit.service');
const { checkRateLimit } = require('@/lib/rateLimiter');
const { revokeToken, verifyToken } = require('@/lib/services/token.service');

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.DIDIT_MOCK;
  process.env.DIDIT_KYC_WORKFLOW_ID = 'kyc-workflow-id';
  process.env.DIDIT_WORKFLOW_ID = 'kyc-workflow-id';
  process.env.SITE_URL = 'http://localhost:3000';
});

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

const approvedProfile = {
  id: 'p1',
  user_id: 'auth_user_1',
  verification_status: 'APPROVED',
  didit_kyc_session_id: 'kyc_sess_prev',
  didit_kyc_session_url: null,
  full_name: 'Ada Lovelace',
  dni: null,
};

describe('POST /api/auth/login', () => {
  it('issues a direct session token for an already-approved user', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(approvedProfile);

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('direct');
    expect(body.token).toBe('mock.user.token');
    expect(createVerificationSession).not.toHaveBeenCalled();
  });

  it('starts KYC and returns 201 for a new (unregistered) user', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(null);
    createVerificationSession.mockResolvedValueOnce({
      session_id: 'sess_kyc_1',
      url: 'https://verify/sess_kyc_1',
      status: 'Not Started',
    });
    createProfile.mockResolvedValueOnce({ id: 'p1' });

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.mode).toBe('kyc');
    expect(body.verification_url).toBe('https://verify/sess_kyc_1');
    expect(createVerificationSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'auth_user_1', workflowId: 'kyc-workflow-id' }),
    );
    expect(createProfile).toHaveBeenCalled();
  });

  it('creates a new KYC session for a pending user (old sessions may be expired)', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce({
      ...approvedProfile,
      id: 'internal_user_1',
      verification_status: 'PENDING',
      didit_kyc_session_url: 'https://verify/old_url',
    });
    createVerificationSession.mockResolvedValueOnce({
      session_id: 'sess_kyc_new',
      url: 'https://verify/sess_kyc_new',
      status: 'Not Started',
    });
    const eq = jest.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValueOnce({ update: jest.fn(() => ({ eq })) });

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('kyc');
    expect(body.verification_url).toBe('https://verify/sess_kyc_new');
    expect(createVerificationSession).toHaveBeenCalled();
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
      data: { user: { ...googleUser, app_metadata: { provider: 'email' } } },
      error: null,
    });
    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/login (DIDIT_MOCK mode)', () => {
  beforeEach(() => {
    process.env.DIDIT_MOCK = 'true';
  });

  it('auto-approves a new user and issues a direct token without calling Didit', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce(null);
    createProfile.mockResolvedValueOnce({ id: 'p1' });

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('direct');
    expect(body.token).toBe('mock.user.token');
    expect(body.kycStatus).toBe('VERIFIED');
    expect(createVerificationSession).not.toHaveBeenCalled();
    expect(createProfile).toHaveBeenCalledWith(
      expect.objectContaining({ verification_status: 'APPROVED' }),
    );
  });

  it('auto-approves a pending user and issues a direct token without calling Didit', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: googleUser }, error: null });
    getProfileByUserId.mockResolvedValueOnce({
      ...approvedProfile,
      verification_status: 'PENDING',
    });

    const res = await login(makePost('/api/auth/login', { supabase_access_token: 'sb' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe('direct');
    expect(body.token).toBe('mock.user.token');
    expect(createVerificationSession).not.toHaveBeenCalled();
    expect(updateProfileFromKycResult).toHaveBeenCalledWith(
      'auth_user_1',
      expect.objectContaining({ verification_status: 'APPROVED' }),
    );
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
