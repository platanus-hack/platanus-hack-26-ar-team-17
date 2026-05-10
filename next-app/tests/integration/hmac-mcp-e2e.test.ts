/**
 * E2E integration test for the HMAC agent authentication flow.
 *
 * Uses REAL crypto throughout (encryptSecret, decryptSecret, verifyHmacSignature,
 * buildHmacPayload, issueToken). Only Supabase I/O, rate limiter, and audit log
 * are mocked. This verifies the full cryptographic round-trip without a live DB.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { POST } from '@/app/api/validate/route';
import { NextRequest } from 'next/server';
import { encryptSecret, generateAgentSecret } from '@/lib/utils/crypto';

jest.mock('@/lib/db/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/lib/services/auditLog.service', () => ({ writeLog: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/services/nonce.service', () => ({
  consumeNonce: jest.fn(),
  cleanupExpiredNonces: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/rateLimiter', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));

const { supabase } = require('@/lib/db/supabase');
const { consumeNonce } = require('@/lib/services/nonce.service');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const AGENT_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';

describe('MCP agent HMAC flow (E2E with real crypto)', () => {
  let apiSecret: string;
  let secretEnc: string;

  beforeAll(() => {
    apiSecret = generateAgentSecret();
    secretEnc = encryptSecret(apiSecret, ENCRYPTION_KEY);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consumeNonce.mockResolvedValue(true);
  });

  function buildRequest(overrides: Partial<{
    agentId: string;
    timestamp: string;
    nonce: string;
    action: string;
    platform: string;
    signature: string;
    signingSecret: string;
  }> = {}): object {
    const agentId = overrides.agentId ?? AGENT_ID;
    const timestamp = overrides.timestamp ?? new Date().toISOString();
    const nonce = overrides.nonce ?? crypto.randomBytes(32).toString('hex');
    const action = overrides.action ?? 'call_tool';
    const platform = overrides.platform ?? 'mcp';
    const signingSecret = overrides.signingSecret ?? apiSecret;

    const payload = `${agentId}|${timestamp}|${nonce}|${action}|${platform}`;
    const signature = overrides.signature ?? crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');

    return { agentId, timestamp, nonce, action, platform, signature };
  }

  function mockAgentLookup(agentData: unknown) {
    supabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: agentData,
              error: agentData ? null : { message: 'not found' },
            }),
          }),
        }),
      }),
    });
  }

  function makeReq(body: object) {
    return new NextRequest('http://localhost/api/validate', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('1. valid signed request returns allowed: true with a verifiable JWT', async () => {
    mockAgentLookup({ id: AGENT_ID, user_id: USER_ID, status: 'ACTIVE', secret_enc: secretEnc });

    const res = await POST(makeReq(buildRequest()));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.allowed).toBe(true);
    expect(typeof json.token).toBe('string');
    expect(typeof json.expiresAt).toBe('string');

    const decoded = jwt.decode(json.token) as Record<string, unknown>;
    expect(decoded.type).toBe('sdk_token');
    expect(decoded.agentId).toBe(AGENT_ID);
    expect(decoded.userId).toBe(USER_ID);
  });

  it('2. replayed nonce returns allowed: false', async () => {
    mockAgentLookup({ id: AGENT_ID, user_id: USER_ID, status: 'ACTIVE', secret_enc: secretEnc });
    consumeNonce.mockResolvedValueOnce(false);

    const res = await POST(makeReq(buildRequest()));
    expect((await res.json()).allowed).toBe(false);
  });

  it('3. tampered signature returns allowed: false', async () => {
    mockAgentLookup({ id: AGENT_ID, user_id: USER_ID, status: 'ACTIVE', secret_enc: secretEnc });

    const body = buildRequest({ signature: 'f'.repeat(64) });
    const res = await POST(makeReq(body));
    expect((await res.json()).allowed).toBe(false);
  });

  it('4. stale timestamp (6 minutes ago) returns allowed: false', async () => {
    const staleTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const body = buildRequest({ timestamp: staleTimestamp });
    // Timestamp check is before agent lookup — no Supabase mock needed
    const res = await POST(makeReq(body));
    expect((await res.json()).allowed).toBe(false);
  });

  it('5. agent with secret_enc = null (unmigrated) returns allowed: false', async () => {
    mockAgentLookup({ id: AGENT_ID, user_id: USER_ID, status: 'ACTIVE', secret_enc: null });

    const res = await POST(makeReq(buildRequest()));
    expect((await res.json()).allowed).toBe(false);
  });

  it('6. realistic MCP payload (platform=mcp, action=call_tool) is accepted', async () => {
    mockAgentLookup({ id: AGENT_ID, user_id: USER_ID, status: 'ACTIVE', secret_enc: secretEnc });

    const body = buildRequest({ action: 'call_tool', platform: 'mcp' });
    const res = await POST(makeReq(body));
    const json = await res.json();

    expect(json.allowed).toBe(true);
    expect(json.token).toBeTruthy();
  });
});
