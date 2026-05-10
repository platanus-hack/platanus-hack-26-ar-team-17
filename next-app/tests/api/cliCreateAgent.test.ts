import { POST } from '@/app/api/cli/create-agent/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/services/profile.service', () => ({
  resolveInternalUserIdByHash: jest.fn(),
}));
jest.mock('@/lib/services/agent.service', () => ({
  countAgentsForUser: jest.fn(),
  createAgent: jest.fn(),
}));

const { resolveInternalUserIdByHash } = require('@/lib/services/profile.service');
const { countAgentsForUser, createAgent } = require('@/lib/services/agent.service');

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/cli/create-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/cli/create-agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when hash does not match any user', async () => {
    resolveInternalUserIdByHash.mockResolvedValue(null);
    const res = await POST(makeReq({ userHash: 'unknown_hash_123' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('unknown_user_hash');
    expect(countAgentsForUser).not.toHaveBeenCalled();
  });

  it('returns 409 when user already has agents', async () => {
    resolveInternalUserIdByHash.mockResolvedValue('internal_user_1');
    countAgentsForUser.mockResolvedValue(1);
    const res = await POST(makeReq({ userHash: 'abc' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('agent_already_exists');
    expect(createAgent).not.toHaveBeenCalled();
  });

  it('creates agent and returns apiKey', async () => {
    resolveInternalUserIdByHash.mockResolvedValue('internal_user_1');
    countAgentsForUser.mockResolvedValue(0);
    createAgent.mockResolvedValue({
      agent: {
        id: 'agent_1',
        user_id: 'internal_user_1',
        name: 'Agente CLI',
        type: 'agent',
        platform: 'cli',
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      },
      key: { id: 'k1', plainKey: 'ak_test_secret', prefix: 'ak_test' },
    });
    const res = await POST(makeReq({ userHash: 'userhash1', name: 'Mi bot', platform: 'node' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.apiKey).toBe('ak_test_secret');
    expect(json.keyPrefix).toBe('ak_test');
    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'internal_user_1',
        name: 'Mi bot',
        type: 'agent',
        platform: 'node',
        keyName: 'cli-default',
      }),
    );
  });
});
