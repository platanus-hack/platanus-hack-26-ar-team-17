import { GET as finalize } from '@/app/api/auth/finalize/route';
import { NextRequest } from 'next/server';
import { APP_SESSION_COOKIE } from '@/lib/cookies';

jest.mock('@/lib/services/loginAttempt.service', () => ({
  getLoginAttempt: jest.fn(),
}));
jest.mock('@/lib/services/profile.service', () => ({
  getProfileByUserId: jest.fn(),
  getSessionFieldsForAuthUser: jest.fn().mockResolvedValue({
    kycStatus: 'VERIFIED',
    displayName: 'Test User',
  }),
  updateProfileFromKycResult: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/token.service', () => ({
  issueUserToken: jest.fn().mockResolvedValue('mock.token'),
}));
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getUser: jest.fn() } },
}));
jest.mock('@/lib/services/didit.service', () => ({
  getSession: jest.fn(),
}));

const { getLoginAttempt } = require('@/lib/services/loginAttempt.service');
const { getProfileByUserId, updateProfileFromKycResult } = require('@/lib/services/profile.service');
const { supabase } = require('@/lib/db/supabase');
const { getSession } = require('@/lib/services/didit.service');

beforeEach(() => jest.clearAllMocks());

function makeReq(qs: string, cookieHeader?: string) {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers['cookie'] = cookieHeader;
  return new NextRequest(`http://localhost/api/auth/finalize?${qs}`, { headers });
}

describe('GET /api/auth/finalize?intent=login', () => {
  it('returns 200 + cookie when login attempt is APPROVED', async () => {
    getLoginAttempt.mockResolvedValueOnce({ session_id: 's', user_id: 'u1', decision: 'APPROVED' });
    const res = await finalize(makeReq('intent=login&session_id=s'));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie') ?? '').toMatch(new RegExp(`${APP_SESSION_COOKIE}=mock\\.token`));
    const json = await res.json();
    expect(json.token).toBe('mock.token');
    expect(json.userId).toBe('u1');
    expect(json.kycStatus).toBe('VERIFIED');
  });

  it('returns 410 when REJECTED', async () => {
    getLoginAttempt.mockResolvedValueOnce({ session_id: 's', user_id: 'u1', decision: 'REJECTED' });
    const res = await finalize(makeReq('intent=login&session_id=s'));
    expect(res.status).toBe(410);
  });

  it('returns 202 when PENDING', async () => {
    getLoginAttempt.mockResolvedValueOnce({ session_id: 's', user_id: 'u1', decision: 'PENDING' });
    const res = await finalize(makeReq('intent=login&session_id=s'));
    expect(res.status).toBe(202);
  });
});

describe('GET /api/auth/finalize?intent=register', () => {
  it('returns 200 + cookie when KYC profile is APPROVED', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ user_id: 'u1', verification_status: 'APPROVED' });
    const res = await finalize(makeReq('intent=register&session_id=s&supabase_access_token=sb'));
    expect(res.status).toBe(200);
  });

  it('returns 410 when REJECTED', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ user_id: 'u1', verification_status: 'REJECTED' });
    const res = await finalize(makeReq('intent=register&session_id=s&supabase_access_token=sb'));
    expect(res.status).toBe(410);
  });

  it('syncs from Didit and returns 200 when local profile is still pending', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    getProfileByUserId.mockResolvedValueOnce({ user_id: 'u1', verification_status: 'PENDING' });
    getSession.mockResolvedValueOnce({
      session_id: 's',
      status: 'Approved',
      workflow_id: 'kyc-workflow-id',
      decision: { kyc: { document_number: '12345678', full_name: 'Ada' } },
    });

    const res = await finalize(makeReq('intent=register&session_id=s&supabase_access_token=sb'));

    expect(res.status).toBe(200);
    expect(updateProfileFromKycResult).toHaveBeenCalledWith('u1', {
      dni: '12345678',
      full_name: 'Ada',
      verification_status: 'APPROVED',
    });
  });
});
