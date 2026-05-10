import { GET, POST } from '@/app/api/keys/route';
import { DELETE } from '@/app/api/keys/[id]/route';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

jest.mock('@/lib/services/token.service', () => ({
  ...jest.requireActual('@/lib/services/token.service'),
  isTokenRevoked: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/auth', () => ({
  getInternalUserId: jest.fn(),
}));

jest.mock('@/lib/services/agent.service', () => ({
  getAgent: jest.fn(),
}));

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
  { userId: 'auth_user_1', type: 'user_session', jti: crypto.randomUUID() },
  JWT_SECRET,
  { expiresIn: '1h' },
);

const AGENT_ID = '00000000-0000-4000-8000-000000000001';
const agentUuid = '550e8400-e29b-41d4-a716-446655440000';

function makeReq(path: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function mockKyc(status: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | null) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: status === null ? null : { id: 'user_1', kyc_status: status },
          error: null,
        }),
      }),
    }),
  });
}

describe('GET /api/keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInternalUserId.mockResolvedValue({ internalId: 'user_1', userHash: 'uh' });
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
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                revoked_at: null,
                agent_id: 'a1',
                agents: { name: 'Bot', platform: 'mcp', type: 'agent', user_id: 'user_1' },
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
    expect(json[0].agent_name).toBe('Bot');
  });

  it('returns 401 without token', async () => {
    getInternalUserId.mockResolvedValueOnce(null);
    const res = await GET(new NextRequest('http://localhost/api/keys'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInternalUserId.mockResolvedValue({ internalId: 'user_1', userHash: 'uh' });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { kyc_status: 'VERIFIED' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
  });

  it('rotates key for agent and returns plainKey', async () => {
    getAgent.mockResolvedValueOnce({
      id: agentUuid,
      type: 'agent',
      user_id: 'user_1',
      name: 'a',
      platform: 'api',
      status: 'ACTIVE',
      created_at: '',
    });
    createApiKey.mockResolvedValueOnce({ id: 'k1', plainKey: 'ak_abc', prefix: 'ak_abc' });

    const res = await POST(
      makeReq('/api/keys', 'POST', { agent_id: agentUuid, name: 'second-key' }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).plainKey).toBeDefined();
    expect(createApiKey).toHaveBeenCalledWith({
      agentId: agentUuid,
      name: 'second-key',
    });
  });

  it('returns 400 for invalid body', async () => {
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'only-name' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 kyc_required when user has not completed KYC', async () => {
    supabase.from.mockImplementationOnce(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { kyc_status: 'PENDING' },
            error: null,
          }),
        }),
      }),
    }));

    const res = await POST(
      makeReq('/api/keys', 'POST', { agent_id: agentUuid, name: 'k' }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('kyc_required');
  });

  it('returns 404 agent_not_found', async () => {
    getAgent.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq('/api/keys', 'POST', { agent_id: agentUuid, name: 'k' }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for MCP agent', async () => {
    getAgent.mockResolvedValueOnce({
      id: agentUuid,
      type: 'mcp',
      user_id: 'user_1',
      name: 'm',
      platform: 'x',
      status: 'ACTIVE',
      created_at: '',
    });
    const res = await POST(
      makeReq('/api/keys', 'POST', { agent_id: agentUuid, name: 'k' }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('mcp_agents_have_no_keys');
  });

  it('returns 401 without token', async () => {
    getInternalUserId.mockResolvedValueOnce(null);
    const res = await POST(new NextRequest('http://localhost/api/keys', { method: 'POST' }));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/keys — validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInternalUserId.mockResolvedValue({ internalId: 'user_1', userHash: 'uh' });
  });

  it('returns 400 when name is an empty string', async () => {
    mockKyc('VERIFIED');
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: AGENT_ID, name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    mockKyc('VERIFIED');
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: AGENT_ID, name: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when agent_id is missing', async () => {
    mockKyc('VERIFIED');
    const res = await POST(makeReq('/api/keys', 'POST', { name: 'key' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 when user not found in DB', async () => {
    mockKyc(null);
    const res = await POST(makeReq('/api/keys', 'POST', { agent_id: AGENT_ID, name: 'ci-key' }));
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/keys/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInternalUserId.mockResolvedValue({ internalId: 'user_1', userHash: 'uh' });
  });

  it('revokes a key', async () => {
    revokeApiKey.mockResolvedValue(undefined);
    const req = makeReq('/api/keys/k1', 'DELETE');
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 401 without auth token', async () => {
    getInternalUserId.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/keys/k1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'k1' }) });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/keys — edge cases', () => {
  beforeEach(() => {
    getInternalUserId.mockResolvedValue({ internalId: 'user_1', userHash: 'uh' });
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
