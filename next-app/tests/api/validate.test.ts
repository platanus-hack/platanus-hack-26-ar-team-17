import { POST } from '@/app/api/validate/route';
import { hashApiKey } from '@/lib/utils/crypto';
import { NextRequest } from 'next/server';

jest.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('@/lib/db/supabase');

const validRecord = {
  id: 'key_1',
  agent_id: 'agent_1',
  status: 'ACTIVE',
  agents: {
    user_id: 'user_1',
    status: 'ACTIVE',
    users: { hash: 'user_hash_1' },
  },
};

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function keyLookup(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });

  return { select, eq, single };
}

describe('POST /api/validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns allowed true when key, user hash, key status, and agent status match', async () => {
    const lookup = keyLookup({ data: validRecord, error: null });
    const auditInsert = jest.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table: string) => {
      if (table === 'api_keys') return { select: lookup.select };
      if (table === 'audit_logs') return { insert: auditInsert };
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(makeRequest({
      token: 'ak_valid',
      hash: 'user_hash_1',
      action: 'mass_send',
      platform: 'mcp',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ allowed: true });
    expect(lookup.eq).toHaveBeenCalledWith('key_hash', hashApiKey('ak_valid'));
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      agent_id: 'agent_1',
      api_key_id: 'key_1',
      user_id: 'user_1',
      action: 'mass_send',
      platform: 'mcp',
      result: 'SUCCESS',
    }));
  });

  it('returns allowed false when the key does not exist', async () => {
    const lookup = keyLookup({ data: null, error: { message: 'not found' } });
    supabase.from.mockReturnValueOnce({ select: lookup.select });

    const res = await POST(makeRequest({
      token: 'ak_missing',
      hash: 'user_hash_1',
      action: 'send_message',
      platform: 'mcp',
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('returns allowed false when the user hash does not match', async () => {
    const lookup = keyLookup({ data: validRecord, error: null });
    supabase.from.mockReturnValueOnce({ select: lookup.select });

    const res = await POST(makeRequest({
      token: 'ak_valid',
      hash: 'wrong_hash',
      action: 'send_message',
      platform: 'mcp',
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false });
  });

  it('returns allowed false when the key is revoked', async () => {
    const lookup = keyLookup({
      data: { ...validRecord, status: 'REVOKED' },
      error: null,
    });
    supabase.from.mockReturnValueOnce({ select: lookup.select });

    const res = await POST(makeRequest({
      token: 'ak_revoked',
      hash: 'user_hash_1',
      action: 'send_message',
      platform: 'mcp',
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false });
  });

  it('returns allowed false when the agent is disabled', async () => {
    const lookup = keyLookup({
      data: { ...validRecord, agents: { ...validRecord.agents, status: 'DISABLED' } },
      error: null,
    });
    supabase.from.mockReturnValueOnce({ select: lookup.select });

    const res = await POST(makeRequest({
      token: 'ak_valid',
      hash: 'user_hash_1',
      action: 'send_message',
      platform: 'mcp',
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false });
  });

  it('returns allowed false for malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/validate', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns allowed false when required fields are missing', async () => {
    const res = await POST(makeRequest({
      token: 'ak_valid',
      action: 'send_message',
      platform: 'mcp',
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
