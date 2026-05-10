import { GET as getAuditLog } from '@/app/api/audit-log/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({ getInternalUserId: jest.fn() }));
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { getInternalUserId } = require('@/lib/auth');
const { supabase } = require('@/lib/db/supabase');

function makeReq(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function mockAuth() {
  getInternalUserId.mockResolvedValueOnce({ internalId: 'internal_user_1', userHash: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  getInternalUserId.mockResolvedValue(null);
});

function mockQuery(returnData: unknown) {
  const terminal = { data: returnData, error: null };
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          range: jest.fn().mockReturnValue({
            then: (resolve: (v: unknown) => void) => resolve(terminal),
            eq: jest.fn().mockReturnValue({
              then: (resolve: (v: unknown) => void) => resolve(terminal),
              eq: jest.fn().mockReturnValue({
                then: (resolve: (v: unknown) => void) => resolve(terminal),
                eq: jest.fn().mockResolvedValue(terminal),
              }),
            }),
          }),
          limit: jest.fn().mockResolvedValue(terminal),
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(terminal),
            }),
          }),
        }),
      }),
    }),
  };
}

describe('GET /api/audit-log', () => {
  it('returns logs for the authenticated user', async () => {
    mockAuth();
    supabase.from.mockReturnValueOnce(mockQuery([{ id: 'l1', result: 'SUCCESS' }]));
    const res = await getAuditLog(makeReq('/api/audit-log'));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(1);
  });

  it('returns 401 without token', async () => {
    getInternalUserId.mockResolvedValueOnce(null);
    const res = await getAuditLog(new NextRequest('http://localhost/api/audit-log'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/audit-log — edge cases', () => {
  it('returns empty array when user has no audit logs', async () => {
    mockAuth();
    supabase.from.mockReturnValueOnce(mockQuery([]));
    const res = await getAuditLog(makeReq('/api/audit-log'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('accepts keyId filter in query string without error', async () => {
    mockAuth();
    supabase.from.mockReturnValueOnce(mockQuery([{ id: 'l1', result: 'SUCCESS' }]));
    const res = await getAuditLog(makeReq('/api/audit-log?keyId=k1'));
    expect(res.status).toBe(200);
  });
});

