import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { hashApiKey, decryptSecret, buildHmacPayload, verifyHmacSignature } from '@/lib/utils/crypto';
import { consumeNonce, cleanupExpiredNonces } from '@/lib/services/nonce.service';
import { issueToken } from '@/lib/services/token.service';
import { writeLog } from '@/lib/services/auditLog.service';
import { checkRateLimit } from '@/lib/rateLimiter';
import { config } from '@/lib/config';

const CLOCK_SKEW_MS = 5 * 60 * 1000;

// HMAC signed request — new SDK (ZERO_AGENT_ID + ZERO_API_SECRET)
const hmacSchema = z.object({
  agentId:   z.string().uuid(),
  timestamp: z.string().min(1),
  nonce:     z.string().min(16),
  action:    z.string().min(1),
  platform:  z.string().min(1),
  signature: z.string().min(1),
});

// API key + user hash — legacy SDK v1 (ZERO_API_KEY + ZERO_USER_HASH)
const legacySchema = z.object({
  token:    z.string().min(1),
  hash:     z.string().min(1),
  action:   z.string().min(1),
  platform: z.string().min(1),
});

let lastCleanup = 0;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ allowed: false }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ allowed: false }); }

  if (body && typeof body === 'object' && 'agentId' in body) {
    return handleHmac(body);
  }
  return handleLegacy(body);
}

// ---------------------------------------------------------------------------
// HMAC path (new SDK)
// ---------------------------------------------------------------------------

async function handleHmac(body: unknown): Promise<NextResponse> {
  const parsed = hmacSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ allowed: false });

  const { agentId, timestamp, nonce, action, platform, signature } = parsed.data;

  const ts = Date.parse(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) {
    return NextResponse.json({ allowed: false });
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, status, secret_enc')
    .eq('id', agentId)
    .eq('status', 'ACTIVE')
    .single<{ id: string; user_id: string; status: string; secret_enc: string | null }>();

  if (!agent || !agent.secret_enc) {
    void writeLog({ agentId: null, userId: null, action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ allowed: false });
  }

  const nonceExpiresAt = new Date(ts + CLOCK_SKEW_MS);
  const nonceOk = await consumeNonce(nonce, agentId, nonceExpiresAt);
  if (!nonceOk) {
    void writeLog({ agentId, userId: agent.user_id, action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ allowed: false });
  }

  if (!config.ENCRYPTION_KEY) return NextResponse.json({ allowed: false });

  let secret: string;
  try {
    secret = decryptSecret(agent.secret_enc, config.ENCRYPTION_KEY);
  } catch {
    return NextResponse.json({ allowed: false });
  }

  const payload = buildHmacPayload(agentId, timestamp, nonce, action, platform);
  if (!verifyHmacSignature(secret, payload, signature)) {
    void writeLog({ agentId, userId: agent.user_id, action, platform, result: 'BLOCKED_INVALID_KEY' });
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

// ---------------------------------------------------------------------------
// Legacy path (old SDK v1)
// ---------------------------------------------------------------------------

async function handleLegacy(body: unknown): Promise<NextResponse> {
  const parsed = legacySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ allowed: false });

  const { token, hash, action, platform } = parsed.data;
  const keyHash = hashApiKey(token);

  const { data } = await supabase
    .from('api_keys')
    .select('id, agent_id, status, agents!inner(user_id, status, users!inner(hash))')
    .eq('key_hash', keyHash)
    .single<{
      id: string;
      agent_id: string;
      status: string;
      agents: { user_id: string; status: string; users: { hash: string } };
    }>();

  const allowed =
    !!data &&
    data.status === 'ACTIVE' &&
    data.agents?.status === 'ACTIVE' &&
    data.agents?.users?.hash === hash;

  if (allowed && data) {
    void writeLog({
      agentId: data.agent_id, apiKeyId: data.id, userId: data.agents.user_id,
      action, platform, result: 'SUCCESS',
    });
  } else {
    void writeLog({
      agentId: data?.agent_id ?? null, apiKeyId: data?.id ?? null,
      userId: data?.agents?.user_id ?? null,
      action, platform, result: 'BLOCKED_INVALID_KEY',
    });
  }

  return NextResponse.json({ allowed });
}
