import { GET as getAuditLog } from '@/app/api/audit-log/route';
import { GET as getAlerts } from '@/app/api/alerts/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('@/lib/services/profile.service', () => ({
  resolveInternalUserId: jest.fn().mockResolvedValue('user_1'),
}));

const { supabase } = require('@/lib/db/supabase');
const JWT_SECRET = 'test-secret-at-least-32-characters-long-hackathon';
const validToken = jwt.sign(
  { userId: 'user_1', type: 'user_session' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function makeReq(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
}

function mockQuery(returnData: unknown) {
  // A chainable query object that resolves at any point
  const terminal = { data: returnData, error: null };
  const chainable: Record<string, jest.Mock> = {};
  const makeMock = (): jest.Mock =>
    jest.fn().mockImplementation(() => {
      // Return a new chainable object so callers can keep chaining
      return new Proxy(terminal, {
        get(_target, prop) {
          if (prop === 'then') {
            // Act as a resolved promise
            return (resolve: (v: unknown) => void) => resolve(terminal);
          }
          return makeMock();
        },
      });
    });

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
    supabase.from.mockReturnValueOnce(mockQuery([{ id: 'l1', result: 'SUCCESS' }]));
    const res = await getAuditLog(makeReq('/api/audit-log'));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await getAuditLog(new NextRequest('http://localhost/api/audit-log'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/alerts', () => {
  it('returns BLOCKED_RULE logs', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [{ id: 'l2', result: 'BLOCKED_RULE' }], error: null }),
            }),
          }),
        }),
      }),
    });
    const res = await getAlerts(makeReq('/api/alerts'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/audit-log — edge cases', () => {
  it('returns empty array when user has no audit logs', async () => {
    supabase.from.mockReturnValueOnce(mockQuery([]));
    const res = await getAuditLog(makeReq('/api/audit-log'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('accepts keyId filter in query string without error', async () => {
    supabase.from.mockReturnValueOnce(mockQuery([{ id: 'l1', result: 'SUCCESS' }]));
    const res = await getAuditLog(makeReq('/api/audit-log?keyId=k1'));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/alerts — edge cases', () => {
  it('returns empty array when no BLOCKED_RULE logs exist', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });
    const res = await getAlerts(makeReq('/api/alerts'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
