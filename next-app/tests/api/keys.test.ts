import { GET, POST } from '@/app/api/keys/route';
import { DELETE } from '@/app/api/keys/[id]/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/services/agent.service');
jest.mock('@/lib/services/profile.service', () => ({
  getProfileByUserId: jest.fn(),
  resolveInternalUserId: jest.fn().mockResolvedValue('user_1'),
}));
jest.mock('@/lib/services/apiKey.service');
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { createAgent } = require('@/lib/services/agent.service');
const { getProfileByUserId, resolveInternalUserId } = require('@/lib/services/profile.service');
const { revokeApiKey } = require('@/lib/services/apiKey.service');
const { supabase } = require('@/lib/db/supabase');

const JWT_SECRET = 'test-secret-at-least-32-characters-long-hackathon';
const validToken = jwt.sign(
  { userId: 'auth_user_1', type: 'user_session' },
  JWT_SECRET,
  { expiresIn: '1h' },
);

function makeReq(path: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('GET /api/keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfileByUserId.mockResolvedValue({
      id: 'user_1',
      verification_status: 'APPROVED',
    });
  });

  it('returns list of keys', async () => {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'k1',
                name: 'default',
                prefix: 'ak_test',
                scope: ['send_message'],
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                agents: { platform: 'mcp', user_id: 'user_1' },
              },
            ],
            error: null,
          }),
        }),
      }),
    });
    const res = await GET(makeReq('/api/keys', 'GET'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.length).toBe(1);
    expect(json[0].platform).toBe('mcp');
  });

  it('returns 401 without token', async () => {
    const res = await GET(new NextRequest('http://localhost/api/keys'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfileByUserId.mockResolvedValue({
      id: 'user_1',
      verification_status: 'APPROVED',
    });
    createAgent.mockResolvedValue({
      agent: { id: 'a1' },
      key: { id: 'k1', plainKey: 'ak_abc', prefix: 'ak_abc' },
    });
  });

  it('creates a key and returns plainKey', async () => {
    const res = await POST(
      makeReq('/api/keys', 'POST', { name: 'Agent', scope: ['send_message'] }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).plainKey).toBeDefined();
    expect(createAgent).toHaveBeenCalled();
  });

  it('returns 400 for invalid scope', async () => {
    const res = await POST(
      makeReq('/api/keys', 'POST', { name: 'Agent', scope: ['mass_send'] }),
    );
    expect(res.status).toBe(400);
    expect(createAgent).not.toHaveBeenCalled();
  });

  it('returns 403 kyc_required when user has not completed KYC', async () => {
    getProfileByUserId.mockResolvedValue({
      id: 'user_1',
      verification_status: 'PENDING',
    });
    const res = await POST(
      makeReq('/api/keys', 'POST', { name: 'Agent', scope: ['send_message'] }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('kyc_required');
  });
});

describe('DELETE /api/keys/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveInternalUserId.mockResolvedValue('user_1');
  });

  it('revokes a key', async () => {
    revokeApiKey.mockResolvedValue(undefined);
    const req = makeReq('/api/keys/k1', 'DELETE');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/keys — edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProfileByUserId.mockResolvedValue({
      id: 'user_1',
      verification_status: 'APPROVED',
    });
    createAgent.mockResolvedValue({
      agent: { id: 'a1' },
      key: { id: 'k1', plainKey: 'ak_abc', prefix: 'ak_abc' },
    });
  });

  it('returns 400 when scope is an empty array', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'Agent', scope: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is an empty string', async () => {
    const res = await POST(
      makeReq('/api/keys', 'POST', { name: '', scope: ['send_message'] }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    const res = await POST(
      makeReq('/api/keys', 'POST', { name: 'a'.repeat(101), scope: ['send_message'] }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when scope is not an array', async () => {
    const res = await POST(
      makeReq('/api/keys', 'POST', { name: 'Agent', scope: 'send_message' as unknown as string[] }),
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/keys — edge cases', () => {
  beforeEach(() => {
    getProfileByUserId.mockResolvedValue({
      id: 'user_1',
      verification_status: 'APPROVED',
    });
  });

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
