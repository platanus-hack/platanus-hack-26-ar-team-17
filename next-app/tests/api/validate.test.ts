import { POST } from '@/app/api/validate/route';
import { hashApiKey } from '@/lib/utils/crypto';
import { NextRequest } from 'next/server';

jest.mock('@/lib/db/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/lib/services/auditLog.service', () => ({ writeLog: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/services/nonce.service', () => ({
  consumeNonce: jest.fn().mockResolvedValue(true),
  cleanupExpiredNonces: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/utils/crypto', () => ({
  ...jest.requireActual('@/lib/utils/crypto'),
  decryptSecret: jest.fn().mockReturnValue('raw-secret'),
  verifyHmacSignature: jest.fn().mockReturnValue(true),
  buildHmacPayload: jest.fn().mockReturnValue('payload-string'),
}));
jest.mock('@/lib/services/token.service', () => ({
  issueToken: jest.fn().mockResolvedValue({ token: 'signed.jwt.token', expiresAt: '2099-01-01T00:05:00.000Z' }),
}));
jest.mock('@/lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/services/rules.service', () => ({
  checkGlobalRules: jest.fn().mockResolvedValue({ blocked: false }),
}));
jest.mock('@/lib/services/scope.service', () => ({
  verifyScope: jest.fn().mockReturnValue(true),
}));

const { supabase } = require('@/lib/db/supabase');
const { consumeNonce } = require('@/lib/services/nonce.service');
const { verifyHmacSignature } = require('@/lib/utils/crypto');
const { writeLog } = require('@/lib/services/auditLog.service');
const { verifyScope } = require('@/lib/services/scope.service');
const { checkGlobalRules } = require('@/lib/services/rules.service');

const AGENT_ID = '00000000-0000-4000-8000-000000000001';
const VALID_TIMESTAMP = new Date().toISOString();
const VALID_BODY = {
  agentId: AGENT_ID,
  timestamp: VALID_TIMESTAMP,
  nonce: 'a'.repeat(64),
  action: 'send_message',
  platform: 'mcp',
  signature: 'b'.repeat(64),
};

const ACTIVE_AGENT = { id: AGENT_ID, user_id: 'user_1', status: 'ACTIVE', secret_enc: 'iv:tag:cipher' };

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/validate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockAgentLookup(data: unknown) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data, error: data ? null : { message: 'not found' } }),
        }),
      }),
    }),
  });
}

describe('POST /api/validate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns allowed: true with token for a valid HMAC request', async () => {
    mockAgentLookup(ACTIVE_AGENT);
    const res = await POST(makeRequest(VALID_BODY));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.allowed).toBe(true);
    expect(json.token).toBe('signed.jwt.token');
    expect(json.expiresAt).toBeDefined();
  });

  it('returns allowed: false when agent is not found', async () => {
    mockAgentLookup(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false when agent has no secret_enc', async () => {
    mockAgentLookup({ ...ACTIVE_AGENT, secret_enc: null });
    const res = await POST(makeRequest(VALID_BODY));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false when nonce is already used (replay)', async () => {
    mockAgentLookup(ACTIVE_AGENT);
    consumeNonce.mockResolvedValueOnce(false);
    const res = await POST(makeRequest(VALID_BODY));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false when HMAC signature is invalid', async () => {
    mockAgentLookup(ACTIVE_AGENT);
    verifyHmacSignature.mockReturnValueOnce(false);
    const res = await POST(makeRequest(VALID_BODY));
    expect((await res.json()).allowed).toBe(false);
  });

  it('returns allowed: false when timestamp is too old', async () => {
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const res = await POST(makeRequest({ ...VALID_BODY, timestamp: staleTimestamp }));
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
    mockAgentLookup(ACTIVE_AGENT);
    await POST(makeRequest(VALID_BODY));
    await new Promise(resolve => setImmediate(resolve));
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'SUCCESS' }));
  });

  it('logs BLOCKED_INVALID_KEY when agent not found', async () => {
    mockAgentLookup(null);
    await POST(makeRequest(VALID_BODY));
    await new Promise(resolve => setImmediate(resolve));
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'BLOCKED_INVALID_KEY' }));
  });
});

const LEGACY_BODY = {
  token: 'ak_legacy_test_token',
  hash: 'sha256-of-user',
  action: 'send_message',
  platform: 'mcp',
};

const validRecord = {
  id: 'key_1',
  agent_id: 'agent_1',
  status: 'ACTIVE',
  scope: ['send_message'],
  agents: {
    user_id: 'user_1',
    status: 'ACTIVE',
    users: { hash: 'user_hash_1' },
  },
};

const ACTIVE_API_KEY_DATA = {
  id: 'key-id-001',
  agent_id: AGENT_ID,
  status: 'ACTIVE',
  scope: ['send_message'],
  agents: { user_id: 'user_1', status: 'ACTIVE', users: { hash: 'sha256-of-user' } },
};

function keyLookup(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  return { select, eq, single };
}

function mockApiKeyLookup(data: unknown) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error: data ? null : { message: 'not found' } }),
      }),
    }),
  });
}

describe('POST /api/validate (legacy API key path)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns allowed: true when API key, agent, and user hash are valid', async () => {
    mockApiKeyLookup(ACTIVE_API_KEY_DATA);
    const res = await POST(makeRequest(LEGACY_BODY));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.allowed).toBe(true);
  });

  it('returns allowed true when key, user hash, key status, and agent status match', async () => {
    const lookup = keyLookup({ data: validRecord, error: null });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'api_keys') return { select: lookup.select };
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(
      makeRequest({
        token: 'ak_valid',
        hash: 'user_hash_1',
        action: 'send_message',
        platform: 'mcp',
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ allowed: true });
    expect(lookup.eq).toHaveBeenCalledWith('key_hash', hashApiKey('ak_valid'));
    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent_1',
        apiKeyId: 'key_1',
        userId: 'user_1',
        action: 'send_message',
        platform: 'mcp',
        result: 'SUCCESS',
      }),
    );
  });

  it('returns allowed: false when key is not found', async () => {
    mockApiKeyLookup(null);
    expect((await (await POST(makeRequest(LEGACY_BODY))).json()).allowed).toBe(false);
  });

  it('returns allowed false when the key does not exist', async () => {
    const lookup = keyLookup({ data: null, error: { message: 'not found' } });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'api_keys') return { select: lookup.select };
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await POST(
      makeRequest({
        token: 'ak_missing',
        hash: 'user_hash_1',
        action: 'send_message',
        platform: 'mcp',
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false });
    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'BLOCKED_INVALID_KEY',
        agentId: null,
      }),
    );
  });

  it('returns allowed: false when key status is REVOKED', async () => {
    mockApiKeyLookup({ ...ACTIVE_API_KEY_DATA, status: 'REVOKED' });
    expect((await (await POST(makeRequest(LEGACY_BODY))).json()).allowed).toBe(false);
  });

  it('returns allowed: false when agent is DISABLED', async () => {
    mockApiKeyLookup({
      ...ACTIVE_API_KEY_DATA,
      agents: { ...ACTIVE_API_KEY_DATA.agents, status: 'DISABLED' },
    });
    expect((await (await POST(makeRequest(LEGACY_BODY))).json()).allowed).toBe(false);
  });

  it('returns allowed: false when user hash does not match', async () => {
    mockApiKeyLookup({
      ...ACTIVE_API_KEY_DATA,
      agents: { ...ACTIVE_API_KEY_DATA.agents, users: { hash: 'wrong-hash' } },
    });
    expect((await (await POST(makeRequest(LEGACY_BODY))).json()).allowed).toBe(false);
  });

  it('returns allowed false when scope rejects action', async () => {
    verifyScope.mockReturnValueOnce(false);
    mockApiKeyLookup(ACTIVE_API_KEY_DATA);
    const res = await POST(makeRequest(LEGACY_BODY));
    expect((await res.json()).allowed).toBe(false);
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'BLOCKED_SCOPE' }));
  });

  it('returns allowed false when global rules block', async () => {
    checkGlobalRules.mockResolvedValueOnce({ blocked: true, ruleViolated: 'FORBIDDEN_KEYWORD' });
    mockApiKeyLookup(ACTIVE_API_KEY_DATA);
    const res = await POST(makeRequest(LEGACY_BODY));
    expect((await res.json()).allowed).toBe(false);
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'BLOCKED_RULE' }));
  });

  it('returns allowed: false when required fields are missing', async () => {
    const res = await POST(makeRequest({ token: 'ak_only', action: 'send_message' }));
    expect((await res.json()).allowed).toBe(false);
  });

  it('logs SUCCESS when allowed', async () => {
    mockApiKeyLookup(ACTIVE_API_KEY_DATA);
    await POST(makeRequest(LEGACY_BODY));
    await new Promise(resolve => setImmediate(resolve));
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'SUCCESS' }));
  });

  it('logs BLOCKED_INVALID_KEY when denied', async () => {
    mockApiKeyLookup(null);
    await POST(makeRequest(LEGACY_BODY));
    await new Promise(resolve => setImmediate(resolve));
    expect(writeLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'BLOCKED_INVALID_KEY' }));
  });
});
