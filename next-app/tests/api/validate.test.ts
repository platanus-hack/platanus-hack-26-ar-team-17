import { POST } from '@/app/api/validate/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('@/lib/services/auditLog.service', () => ({
  writeLog: jest.fn().mockResolvedValue({}),
}));

const { supabase } = require('@/lib/db/supabase');

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const validData = {
  id: 'key_1',
  agent_id: 'agent_1',
  status: 'ACTIVE',
  agents: { user_id: 'user_1', status: 'ACTIVE', users: { hash: 'correct-hash' } },
};

function mockLookup(data: unknown) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error: data ? null : { message: 'not found' } }),
      }),
    }),
  });
}

describe('POST /api/validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns allowed: true for a valid key and matching hash', async () => {
    mockLookup(validData);
    const res = await POST(makeRequest({ token: 'ak_valid', hash: 'correct-hash', action: 'send_message', platform: 'mcp' }));
    expect(res.status).toBe(200);
    expect((await res.json()).allowed).toBe(true);
  });

  it('returns allowed: false for an unknown key', async () => {
    mockLookup(null);
    const res = await POST(makeRequest({ token: 'ak_bad', hash: 'hash', action: 'send_message', platform: 'mcp' }));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false when user hash does not match', async () => {
    mockLookup(validData);
    const res = await POST(makeRequest({ token: 'ak_valid', hash: 'wrong-hash', action: 'send_message', platform: 'mcp' }));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false for a revoked key', async () => {
    mockLookup({ ...validData, status: 'REVOKED' });
    const res = await POST(makeRequest({ token: 'ak_valid', hash: 'correct-hash', action: 'send_message', platform: 'mcp' }));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false for a disabled agent', async () => {
    mockLookup({ ...validData, agents: { ...validData.agents, status: 'DISABLED' } });
    const res = await POST(makeRequest({ token: 'ak_valid', hash: 'correct-hash', action: 'send_message', platform: 'mcp' }));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/validate', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    });
    expect((await (await POST(req)).json()).allowed).toBe(false);
  });

  it('returns allowed: false when required fields are missing', async () => {
    const res = await POST(makeRequest({ action: 'send_message', platform: 'mcp' }));
    expect((await res.json()).allowed).toBe(false);
  });

  it('logs SUCCESS when allowed', async () => {
    const { writeLog } = require('@/lib/services/auditLog.service');
    mockLookup(validData);
    await POST(makeRequest({ token: 'ak_valid', hash: 'correct-hash', action: 'send_message', platform: 'mcp' }));
    await new Promise(resolve => setImmediate(resolve));
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'SUCCESS' }));
  });

  it('logs BLOCKED_INVALID_KEY when denied', async () => {
    const { writeLog } = require('@/lib/services/auditLog.service');
    mockLookup(null);
    await POST(makeRequest({ token: 'ak_bad', hash: 'hash', action: 'send_message', platform: 'mcp' }));
    await new Promise(resolve => setImmediate(resolve));
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'BLOCKED_INVALID_KEY' }));
  });
});
