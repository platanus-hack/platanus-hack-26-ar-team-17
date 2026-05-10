import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { decryptSecret, buildHmacPayload, verifyHmacSignature } from '@/lib/utils/crypto';
import { consumeNonce, cleanupExpiredNonces } from '@/lib/services/nonce.service';
import { issueToken } from '@/lib/services/token.service';
import { writeLog } from '@/lib/services/auditLog.service';
import { checkRateLimit } from '@/lib/rateLimiter';
import { config } from '@/lib/config';

const CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

const bodySchema = z.object({
  agentId:   z.string().uuid(),
  timestamp: z.string().min(1),
  nonce:     z.string().min(16),
  action:    z.string().min(1),
  platform:  z.string().min(1),
  signature: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ allowed: false }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ allowed: false }); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ allowed: false });

  const { agentId, timestamp, nonce, action, platform, signature } = parsed.data;

  // 1. Timestamp validation — reject stale or future-dated requests
  const ts = Date.parse(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) {
    return NextResponse.json({ allowed: false });
  }

  // 2. Fetch agent (must be ACTIVE)
  const { data: agent } = await supabase
    .from('agents')
    .select('id, user_id, status, secret_enc')
    .eq('id', agentId)
    .eq('status', 'ACTIVE')
    .single<{ id: string; user_id: string; status: string; secret_enc: string | null }>();

  if (!agent || !agent.secret_enc) {
    void writeLog({ agentId: null, apiKeyId: null, userId: null, action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ allowed: false });
  }

  // 3. Consume nonce — DB unique constraint rejects replays
  const nonceExpiresAt = new Date(ts + CLOCK_SKEW_MS);
  const nonceOk = await consumeNonce(nonce, agentId, nonceExpiresAt);
  if (!nonceOk) {
    void writeLog({ agentId, apiKeyId: null, userId: agent.user_id, action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ allowed: false });
  }

  // 4. Decrypt HMAC secret and verify signature
  if (!config.ENCRYPTION_KEY) {
    return NextResponse.json({ allowed: false });
  }
  let secret: string;
  try {
    secret = decryptSecret(agent.secret_enc, config.ENCRYPTION_KEY);
  } catch {
    return NextResponse.json({ allowed: false });
  }

  const payload = buildHmacPayload(agentId, timestamp, nonce, action, platform);
  const valid = verifyHmacSignature(secret, payload, signature);

  if (!valid) {
    void writeLog({ agentId, apiKeyId: null, userId: agent.user_id, action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ allowed: false });
  }

  // 5. Issue 5-minute JWT
  const { token, expiresAt: tokenExpiresAt } = await issueToken({ agentId, userId: agent.user_id }, '5m');

  void writeLog({ agentId, apiKeyId: null, userId: agent.user_id, action, platform, result: 'SUCCESS' });
  void cleanupExpiredNonces();

  return NextResponse.json({ allowed: true, token, expiresAt: tokenExpiresAt });
}
