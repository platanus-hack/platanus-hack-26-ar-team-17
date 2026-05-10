import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { hashApiKey, decryptSecret, buildHmacPayload, verifyHmacSignature } from '@/lib/utils/crypto';
import { consumeNonce, cleanupExpiredNonces } from '@/lib/services/nonce.service';
import { issueToken } from '@/lib/services/token.service';
import { writeLog } from '@/lib/services/auditLog.service';
import { checkRateLimit } from '@/lib/rateLimiter';
import { config } from '@/lib/config';
import { checkGlobalRules } from '@/lib/services/rules.service';
import { verifyScope } from '@/lib/services/scope.service';

const CLOCK_SKEW_MS = 5 * 60 * 1000;

const hmacSchema = z.object({
  agentId: z.string().uuid(),
  timestamp: z.string().min(1),
  nonce: z.string().min(16),
  action: z.string().min(1),
  platform: z.string().min(1),
  signature: z.string().min(1),
});

const legacySchema = z.object({
  token: z.string().min(1),
  hash: z.string().min(1),
  action: z.string().min(1),
  platform: z.string().min(1),
  text: z.string().optional().default(''),
});

type KeyRow = {
  id: string;
  agent_id: string;
  status: string;
  scope: string[] | null;
  agents: {
    user_id: string;
    status: string;
    users: { hash: string };
  };
};

let lastCleanup = 0;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ allowed: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ allowed: false }, { status: 200 });
  }

  if (body && typeof body === 'object' && 'agentId' in body) {
    return handleHmac(body);
  }
  return handleLegacy(body);
}

async function handleHmac(body: unknown): Promise<NextResponse> {
  const parsed = hmacSchema.safeParse(body);
  if (!parsed.success) {
    const raw = body as Record<string, unknown> | null;
    void writeLog({
      agentId: typeof raw?.agentId === 'string' ? raw.agentId : null,
      userId: null,
      action: typeof raw?.action === 'string' ? raw.action : 'unknown',
      platform: typeof raw?.platform === 'string' ? raw.platform : 'unknown',
      result: 'BLOCKED_INVALID_KEY',
      ruleViolated: 'hmac_schema_invalid',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const { agentId, timestamp, nonce, action, platform, signature } = parsed.data;

  const ts = Date.parse(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) {
    void writeLog({
      agentId, userId: null, action, platform,
      result: 'BLOCKED_INVALID_KEY',
      ruleViolated: 'clock_skew',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, status, platform, secret_enc')
    .eq('id', agentId)
    .eq('status', 'ACTIVE')
    .single<{ id: string; user_id: string; status: string; platform: string; secret_enc: string | null }>();

  if (!agent || !agent.secret_enc) {
    void writeLog({ agentId: null, userId: null, action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ allowed: false });
  }

  // Universal agents (platform: 'all') accept any caller platform; otherwise the
  // request platform must match the agent's registered platform.
  if (agent.platform !== 'all' && agent.platform !== platform) {
    void writeLog({
      agentId, userId: agent.user_id, action, platform,
      result: 'BLOCKED_RULE',
      ruleViolated: `platform_mismatch:agent=${agent.platform},request=${platform}`,
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const nonceExpiresAt = new Date(ts + CLOCK_SKEW_MS);
  const nonceOk = await consumeNonce(nonce, agentId, nonceExpiresAt);
  if (!nonceOk) {
    void writeLog({ agentId, userId: agent.user_id, action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ allowed: false });
  }

  if (!config.ENCRYPTION_KEY) {
    void writeLog({
      agentId, userId: agent.user_id, action, platform,
      result: 'BLOCKED_INVALID_KEY',
      ruleViolated: 'encryption_key_missing',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  let secret: string;
  try {
    secret = decryptSecret(agent.secret_enc, config.ENCRYPTION_KEY);
  } catch {
    void writeLog({
      agentId, userId: agent.user_id, action, platform,
      result: 'BLOCKED_INVALID_KEY',
      ruleViolated: 'secret_decrypt_failed',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const payload = buildHmacPayload(agentId, timestamp, nonce, action, platform);
  if (!verifyHmacSignature(secret, payload, signature)) {
    void writeLog({
      agentId, userId: agent.user_id, action, platform,
      result: 'BLOCKED_INVALID_KEY',
      ruleViolated: 'hmac_signature_mismatch',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const { token, expiresAt: tokenExpiresAt } = await issueToken({ agentId, userId: agent.user_id });

  void writeLog({ agentId, userId: agent.user_id, action, platform, result: 'SUCCESS' });

  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    void cleanupExpiredNonces();
  }

  return NextResponse.json({ allowed: true, token, expiresAt: tokenExpiresAt });
}

async function handleLegacy(body: unknown): Promise<NextResponse> {
  const parsed = legacySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ allowed: false }, { status: 200 });

  const { token, hash, action, platform, text } = parsed.data;
  const keyHash = hashApiKey(token);

  const { data } = await supabase
    .from('api_keys')
    .select(
      'id, agent_id, status, scope, agents!inner(user_id, status, users!inner(hash))',
    )
    .eq('key_hash', keyHash)
    .single<KeyRow>();

  const baseLog = {
    action,
    platform,
    userInput: text,
  };

  if (!data) {
    void writeLog({
      agentId: null,
      apiKeyId: null,
      userId: null,
      ...baseLog,
      result: 'BLOCKED_INVALID_KEY',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const keyOk =
    data.status === 'ACTIVE' &&
    data.agents?.status === 'ACTIVE' &&
    data.agents?.users?.hash === hash;

  if (!keyOk) {
    void writeLog({
      agentId: data.agent_id,
      apiKeyId: data.id,
      userId: data.agents.user_id,
      ...baseLog,
      result: 'BLOCKED_INVALID_KEY',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const scope = Array.isArray(data.scope) ? data.scope : [];

  if (!verifyScope(action, scope)) {
    void writeLog({
      agentId: data.agent_id,
      apiKeyId: data.id,
      userId: data.agents.user_id,
      ...baseLog,
      result: 'BLOCKED_SCOPE',
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  const ruleCheck = await checkGlobalRules({ action, text });
  if (ruleCheck.blocked) {
    void writeLog({
      agentId: data.agent_id,
      apiKeyId: data.id,
      userId: data.agents.user_id,
      ...baseLog,
      result: 'BLOCKED_RULE',
      ruleViolated: ruleCheck.ruleViolated,
    }).catch(() => {});
    return NextResponse.json({ allowed: false });
  }

  void writeLog({
    agentId: data.agent_id,
    apiKeyId: data.id,
    userId: data.agents.user_id,
    ...baseLog,
    result: 'SUCCESS',
  }).catch(() => {});

  return NextResponse.json({ allowed: true });
}
