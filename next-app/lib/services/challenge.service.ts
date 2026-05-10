import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase';
import { buildChallengePayload, verifyEd25519Signature, verifyMLDSASignature } from '../utils/ed25519';
import { issueAgentSessionToken } from './token.service';
import { writeLog } from './auditLog.service';
import { config } from '../config';

export interface ChallengeResponse {
  challengeId: string;
  nonce: string;
  timestamp: string;
  expiresAt: string;
}

export interface VerifyResponse {
  accessToken: string;
  expiresAt: string;
  receipt: string;
}

export async function createChallenge(
  agentId: string,
  requestedAction: string,
  platform: string,
): Promise<ChallengeResponse> {
  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id, status, public_key')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent) throw new ChallengeError('agent_not_found', 404);
  if (agent.status === 'DISABLED') throw new ChallengeError('agent_revoked', 403);
  if (!agent.public_key) throw new ChallengeError('agent_not_registered', 400);

  const nonce = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60_000);

  const { data: challenge, error: insertErr } = await supabase
    .from('auth_challenges')
    .insert({
      agent_id: agentId,
      nonce,
      requested_action: requestedAction,
      platform,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, created_at')
    .single();

  if (insertErr || !challenge) throw new ChallengeError('challenge_create_failed', 500);

  await writeLog({
    agentId,
    apiKeyId: null,
    userId: null,
    action: requestedAction,
    platform,
    result: 'AUTH_CHALLENGE_ISSUED',
  }).catch(() => {});

  return {
    challengeId: challenge.id,
    nonce,
    timestamp: challenge.created_at,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyChallenge(
  agentId: string,
  challengeId: string,
  signatureHex: string,
  signaturePqcHex?: string,
): Promise<VerifyResponse> {
  const { data: challenge, error: challengeErr } = await supabase
    .from('auth_challenges')
    .select('id, agent_id, nonce, expires_at, used, platform')
    .eq('id', challengeId)
    .eq('agent_id', agentId)
    .single();

  if (challengeErr || !challenge) throw new ChallengeError('challenge_not_found', 404);
  if (challenge.used) throw new ChallengeError('challenge_already_used', 401);
  if (new Date(challenge.expires_at) < new Date()) throw new ChallengeError('challenge_expired', 401);

  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .select('id, status, public_key, public_key_pqc, did')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent) throw new ChallengeError('agent_not_found', 404);
  if (agent.status === 'DISABLED') throw new ChallengeError('agent_revoked', 403);

  const payload = buildChallengePayload(challengeId, challenge.nonce, agentId);

  if (agent.public_key_pqc) {
    if (!signaturePqcHex) {
      await supabase.from('auth_challenges').update({ used: true }).eq('id', challengeId);
      throw new ChallengeError('pqc_signature_required', 400);
    }
    const pqcValid = verifyMLDSASignature(agent.public_key_pqc, payload, signaturePqcHex);
    if (!pqcValid) {
      await supabase.from('auth_challenges').update({ used: true }).eq('id', challengeId);
      await writeLog({
        agentId,
        apiKeyId: null,
        userId: null,
        action: 'agent_auth',
        platform: challenge.platform ?? 'unknown',
        result: 'AUTH_FAILED',
      }).catch(() => {});
      throw new ChallengeError('invalid_pqc_signature', 401);
    }
  }

  const valid = verifyEd25519Signature(agent.public_key, payload, signatureHex);

  await supabase.from('auth_challenges').update({ used: true }).eq('id', challengeId);

  if (!valid) {
    await writeLog({
      agentId,
      apiKeyId: null,
      userId: null,
      action: 'agent_auth',
      platform: 'unknown',
      result: 'AUTH_FAILED',
    }).catch(() => {});
    throw new ChallengeError('invalid_signature', 401);
  }

  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const accessToken = issueAgentSessionToken(agentId, agent.did ?? '');

  const receipt = jwt.sign(
    {
      type: 'auth_receipt',
      receiptId: crypto.randomUUID(),
      agentId,
      action: 'agent_auth',
      platform: challenge.platform ?? 'unknown',
      result: 'AUTH_SUCCESS',
      timestamp: new Date().toISOString(),
    },
    config.JWT_SECRET,
    { expiresIn: '1h' },
  );

  await writeLog({
    agentId,
    apiKeyId: null,
    userId: null,
    action: 'agent_auth',
    platform: challenge.platform ?? 'unknown',
    result: 'AUTH_SUCCESS',
  }).catch(() => {});

  return { accessToken, expiresAt, receipt };
}

export class ChallengeError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}
