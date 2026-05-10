import { POST } from '@/app/api/agents/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getInternalUserId: jest.fn(),
}));

jest.mock('@/lib/services/agent.service', () => ({
  createAgent: jest.fn(),
  getMcpUrl: jest.fn((userHash: string, agentId: string, baseUrl: string) => `${baseUrl}/api/mcp/${userHash}/${agentId}`),
  listAgentsWithMcpUrl: jest.fn(),
}));

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { getInternalUserId } = require('@/lib/auth');
const { createAgent } = require('@/lib/services/agent.service');
const { supabase } = require('@/lib/db/supabase');

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockKyc(status: 'PENDING' | 'VERIFIED' | null) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: status === null ? null : { kyc_status: status },
          error: null,
        }),
      }),
    }),
  });
}

describe('POST /api/agents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInternalUserId.mockResolvedValue({ internalId: 'user_1', userHash: 'hash_1' });
  });

  it('requires KYC before creating agent credentials', async () => {
    mockKyc('PENDING');

    const res = await POST(makeReq({ name: 'Bot', platform: 'api', type: 'agent' }));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('kyc_required');
    expect(createAgent).not.toHaveBeenCalled();
  });

  it('creates an agent for a verified user', async () => {
    mockKyc('VERIFIED');
    createAgent.mockResolvedValueOnce({
      agent: {
        id: 'agent_1',
        user_id: 'user_1',
        name: 'Bot',
        type: 'agent',
        platform: 'api',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      },
      key: { id: 'key_1', plainKey: 'ak_once', prefix: 'ak_once' },
      apiSecret: 'secret_once',
    });

    const res = await POST(makeReq({ name: 'Bot', platform: 'api', type: 'agent' }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.key.plainKey).toBe('ak_once');
    expect(json.apiSecret).toBe('secret_once');
    expect(createAgent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_1' }));
  });
});
