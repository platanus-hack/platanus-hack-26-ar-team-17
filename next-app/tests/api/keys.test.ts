import { GET, POST } from '@/app/api/keys/route';
import { DELETE } from '@/app/api/keys/[id]/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/services/apiKey.service');
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { createApiKey, revokeApiKey } = require('@/lib/services/apiKey.service');
const { supabase } = require('@/lib/db/supabase');

const JWT_SECRET = 'test-secret-at-least-32-characters-long-hackathon';
const validToken = jwt.sign(
  { userId: 'user_1', type: 'user_session' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function makeReq(path: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('GET /api/keys', () => {
  it('returns list of keys', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [{ id: 'k1', name: 'Agent', prefix: 'ak_test' }], error: null }),
        }),
      }),
    });
    const res = await GET(makeReq('/api/keys', 'GET'));
    expect(res.status).toBe(200);
    expect((await res.json()).length).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await GET(new NextRequest('http://localhost/api/keys'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/keys', () => {
  it('creates a key and returns plainKey', async () => {
    createApiKey.mockResolvedValue({ id: 'k1', plainKey: 'ak_abc', prefix: 'ak_abc' });
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'Agent', scope: ['send_message'] }));
    expect(res.status).toBe(201);
    expect((await res.json()).plainKey).toBeDefined();
  });

  it('returns 400 for invalid scope', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'Agent', scope: ['mass_send'] }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/keys/[id]', () => {
  it('revokes a key', async () => {
    revokeApiKey.mockResolvedValue(undefined);
    const req = makeReq('/api/keys/k1', 'DELETE');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(200);
  });
});
