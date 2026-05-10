import { GET, POST } from '@/app/api/keys/route';
import { DELETE } from '@/app/api/keys/[id]/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

jest.mock('@/lib/auth', () => ({ getInternalUserId: jest.fn() }));
jest.mock('@/lib/services/agent.service');
jest.mock('@/lib/services/apiKey.service');
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { getInternalUserId } = require('@/lib/auth');
const { getAgent } = require('@/lib/services/agent.service');
const { createApiKey, revokeApiKey } = require('@/lib/services/apiKey.service');
const { supabase } = require('@/lib/db/supabase');

const JWT_SECRET = 'test-secret-at-least-32-characters-long-hackathon';
const validToken = jwt.sign(
  { userId: 'supabase_user_1', type: 'user_session' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const INTERNAL_USER = { internalId: 'internal_user_1', userHash: null };
const AGENT_ID = '00000000-0000-4000-8000-000000000001';

function makeReq(path: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function mockAuth() {
  getInternalUserId.mockResolvedValueOnce(INTERNAL_USER);
}

function mockKyc(status: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | null) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: status === null ? null : { id: 'internal_user_1', kyc_status: status },
          error: null,
        }),
      }),
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  getInternalUserId.mockResolvedValue(null); // default: unauthorized
});

describe('GET /api/keys', () => {
  const keyRow = {
    id: 'k1', name: 'default', prefix: 'ak_test', status: 'ACTIVE',
    created_at: '2025-01-01T00:00:00Z', revoked_at: null, agent_id: AGENT_ID,
    agents: { name: 'My Agent', platform: 'mcp', type: 'agent', user_id: 'internal_user_1' },
  };

  it('returns list of keys', async () => {
    mockAuth();
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [keyRow], error: null }),
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

  it('returns empty array when user has no keys', async () => {
    mockAuth();
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

describe('POST /api/keys', () => {
  const validBody = { agent_id: AGENT_ID, name: 'ci-key' };

  it('creates a key and returns plainKey', async () => {
    mockAuth();
    mockKyc('VERIFIED');
    getAgent.mockResolvedValueOnce({ id: AGENT_ID, name: 'Agent', type: 'agent', platform: 'mcp' });
    createApiKey.mockResolvedValueOnce({ id: 'k1', plainKey: 'ak_abc', prefix: 'ak_abc' });
    const res = await POST(makeReq('/api/keys', 'POST', validBody));
    expect(res.status).toBe(201);
    expect((await res.json()).plainKey).toBeDefined();
  });

  it('returns 403 when user has not completed KYC', async () => {
    mockAuth();
    mockKyc('PENDING');
    const res = await POST(makeReq('/api/keys', 'POST', validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('kyc_required');
  });

  it('returns 403 when user not found in DB', async () => {
    mockAuth();
    mockKyc(null);
    const res = await POST(makeReq('/api/keys', 'POST', validBody));
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await POST(new NextRequest('http://localhost/api/keys', { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/keys — validation', () => {
  it('returns 400 when name is an empty string', async () => {
    mockAuth();
    mockKyc('VERIFIED');
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: AGENT_ID, name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    mockAuth();
    mockKyc('VERIFIED');
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: AGENT_ID, name: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when agent_id is missing', async () => {
    mockAuth();
    mockKyc('VERIFIED');
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'key' }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/keys/[id]', () => {
  it('revokes a key', async () => {
    mockAuth();
    revokeApiKey.mockResolvedValue(undefined);
    const req = makeReq('/api/keys/k1', 'DELETE');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 401 without auth token', async () => {
    const req = new NextRequest('http://localhost/api/keys/k1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(401);
  });
});
