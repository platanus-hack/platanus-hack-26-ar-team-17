import { GET as getAuditLog } from '@/app/api/audit-log/route';
import { GET as getAlerts } from '@/app/api/alerts/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
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
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          range: jest.fn().mockResolvedValue({ data: returnData, error: null }),
          limit: jest.fn().mockResolvedValue({ data: returnData, error: null }),
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: returnData, error: null }),
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
