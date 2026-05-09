import { GET, POST } from '@/app/api/keys/route';
import { DELETE } from '@/app/api/keys/[id]/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/services/apiKey.service');
jest.mock('@/lib/services/agent.service');
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { createApiKey, revokeApiKey } = require('@/lib/services/apiKey.service');
const { getAgent } = require('@/lib/services/agent.service');
const { supabase } = require('@/lib/db/supabase');

const JWT_SECRET = 'test-secret-at-least-32-characters-long-hackathon';
const validToken = jwt.sign(
  { userId: 'user_1', type: 'user_session' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const validAgentId = '11111111-1111-4111-9111-111111111111';

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
          order: jest.fn().mockResolvedValue({ data: [{ id: 'k1', name: 'default', prefix: 'ak_test' }], error: null }),
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
  beforeEach(() => jest.clearAllMocks());

  it('creates a rotated key for an owned agent', async () => {
    getAgent.mockResolvedValue({ id: validAgentId, user_id: 'user_1', name: 'WhatsApp', platform: 'whatsapp', scope: ['send_message'], status: 'ACTIVE' });
    createApiKey.mockResolvedValue({ id: 'k1', plainKey: 'ak_abc', prefix: 'ak_abc' });
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: validAgentId, name: 'rotated' }));
    expect(res.status).toBe(201);
    expect((await res.json()).plainKey).toBeDefined();
  });

  it('returns 404 when the agent is not owned by the user', async () => {
    getAgent.mockResolvedValue(null);
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: validAgentId, name: 'rotated' }));
    expect(res.status).toBe(404);
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

describe('POST /api/keys — edge cases', () => {
  it('returns 400 when agent_id is missing', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'rotated' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when agent_id is not a uuid', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: 'not-a-uuid', name: 'rotated' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is an empty string', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: validAgentId, name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: validAgentId, name: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/keys — edge cases', () => {
  it('returns empty array when user has no keys', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const res = await GET(makeReq('/api/keys', 'GET'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('DELETE /api/keys/[id] — edge cases', () => {
  it('returns 401 without auth token', async () => {
    const req = new NextRequest('http://localhost/api/keys/k1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(401);
  });
});
