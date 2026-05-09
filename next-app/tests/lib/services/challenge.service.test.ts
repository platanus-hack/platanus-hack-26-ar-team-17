import { generateKeyPairSync, sign as cryptoSign } from 'crypto';
import { createChallenge, verifyChallenge } from '@/lib/services/challenge.service';
import { buildChallengePayload } from '@/lib/utils/ed25519';

jest.mock('@/lib/db/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/lib/services/auditLog.service', () => ({ writeLog: jest.fn().mockResolvedValue({}) }));

const { supabase } = require('@/lib/db/supabase');
const { writeLog } = require('@/lib/services/auditLog.service');

// Helpers for building the fluent Supabase chain mocks

function makeSelectSingle(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  const eq2 = jest.fn().mockReturnValue({ single });
  const eq1 = jest.fn().mockReturnValue({ eq: eq2, single });
  return { select: jest.fn().mockReturnValue({ eq: eq1 }) };
}

function makeSelectSingleOneEq(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ single });
  return { select: jest.fn().mockReturnValue({ eq }) };
}

function makeInsertSelectSingle(result: unknown) {
  const single = jest.fn().mockResolvedValue(result);
  return { insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) }) };
}

function makeUpdate() {
  return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  writeLog.mockResolvedValue({});
});

// Keypair for end-to-end signature tests
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
const pubHex = pubDer.slice(12).toString('hex');

describe('createChallenge', () => {
  it('returns a challenge with challengeId, nonce, timestamp, expiresAt', async () => {
    supabase.from
      .mockReturnValueOnce(makeSelectSingleOneEq({ data: { id: 'a-1', status: 'ACTIVE', public_key: 'a'.repeat(64) }, error: null }))
      .mockReturnValueOnce(makeInsertSelectSingle({ data: { id: 'chal-1', created_at: '2024-01-01T00:00:00Z' }, error: null }));

    const result = await createChallenge('a-1', 'send_message', 'mcp');
    expect(result.challengeId).toBe('chal-1');
    expect(result.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expiresAt).toBeDefined();
  });

  it('throws agent_not_found when agent does not exist', async () => {
    supabase.from.mockReturnValueOnce(makeSelectSingleOneEq({ data: null, error: { message: 'not found' } }));
    await expect(createChallenge('missing', 'action', 'mcp'))
      .rejects.toMatchObject({ code: 'agent_not_found', status: 404 });
  });

  it('throws agent_revoked when agent is DISABLED', async () => {
    supabase.from.mockReturnValueOnce(makeSelectSingleOneEq({ data: { id: 'a-1', status: 'DISABLED', public_key: 'a'.repeat(64) }, error: null }));
    await expect(createChallenge('a-1', 'action', 'mcp'))
      .rejects.toMatchObject({ code: 'agent_revoked', status: 403 });
  });

  it('throws agent_not_registered when public_key is missing', async () => {
    supabase.from.mockReturnValueOnce(makeSelectSingleOneEq({ data: { id: 'a-1', status: 'ACTIVE', public_key: null }, error: null }));
    await expect(createChallenge('a-1', 'action', 'mcp'))
      .rejects.toMatchObject({ code: 'agent_not_registered', status: 400 });
  });
});

describe('verifyChallenge', () => {
  function setupVerifyMocks(challengeData: unknown, agentData: unknown) {
    supabase.from
      .mockReturnValueOnce(makeSelectSingle(challengeData))   // auth_challenges select
      .mockReturnValueOnce(makeSelectSingleOneEq(agentData))  // agents select
      .mockReturnValueOnce(makeUpdate());                      // auth_challenges update
  }

  it('returns an accessToken for a valid signature', async () => {
    const nonce = 'valid-nonce';
    const payload = buildChallengePayload('chal-1', nonce, 'agent-1');
    const sig = cryptoSign(null, Buffer.from(payload, 'utf8'), privateKey).toString('hex');

    setupVerifyMocks(
      { data: { id: 'chal-1', agent_id: 'agent-1', nonce, expires_at: new Date(Date.now() + 60000).toISOString(), used: false }, error: null },
      { data: { id: 'agent-1', status: 'ACTIVE', public_key: pubHex, did: 'did:zero:test', scope: ['send_message'] }, error: null },
    );

    const result = await verifyChallenge('agent-1', 'chal-1', sig);
    expect(result.accessToken).toBeDefined();
    expect(result.expiresAt).toBeDefined();
  });

  it('throws challenge_not_found for unknown challengeId', async () => {
    supabase.from.mockReturnValueOnce(makeSelectSingle({ data: null, error: { message: 'not found' } }));
    await expect(verifyChallenge('agent-1', 'missing', 'a'.repeat(128)))
      .rejects.toMatchObject({ code: 'challenge_not_found', status: 404 });
  });

  it('throws challenge_already_used for a used challenge', async () => {
    supabase.from.mockReturnValueOnce(makeSelectSingle({
      data: { id: 'c', agent_id: 'a', nonce: 'n', expires_at: new Date(Date.now() + 60000).toISOString(), used: true }, error: null,
    }));
    await expect(verifyChallenge('a', 'c', 'a'.repeat(128)))
      .rejects.toMatchObject({ code: 'challenge_already_used', status: 401 });
  });

  it('throws challenge_expired for an expired challenge', async () => {
    supabase.from.mockReturnValueOnce(makeSelectSingle({
      data: { id: 'c', agent_id: 'a', nonce: 'n', expires_at: new Date(Date.now() - 5000).toISOString(), used: false }, error: null,
    }));
    await expect(verifyChallenge('a', 'c', 'a'.repeat(128)))
      .rejects.toMatchObject({ code: 'challenge_expired', status: 401 });
  });

  it('throws invalid_signature for a wrong signature', async () => {
    const nonce = 'bad-nonce';
    setupVerifyMocks(
      { data: { id: 'chal-2', agent_id: 'agent-1', nonce, expires_at: new Date(Date.now() + 60000).toISOString(), used: false }, error: null },
      { data: { id: 'agent-1', status: 'ACTIVE', public_key: pubHex, did: 'did:zero:test', scope: [] }, error: null },
    );
    await expect(verifyChallenge('agent-1', 'chal-2', 'a'.repeat(128)))
      .rejects.toMatchObject({ code: 'invalid_signature', status: 401 });
  });
});
