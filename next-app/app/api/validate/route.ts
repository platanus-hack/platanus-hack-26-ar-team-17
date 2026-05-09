import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKeyHash } from '@/lib/services/apiKey.service';
import { issueToken, verifyToken, isTokenRevoked } from '@/lib/services/token.service';
import { verifyScope } from '@/lib/services/scope.service';
import { checkGlobalRules } from '@/lib/services/rules.service';
import { writeLog } from '@/lib/services/auditLog.service';
import { checkRateLimit } from '@/lib/rateLimiter';

const bodySchema = z.object({
  api_key_hash: z.string().min(1),
  action: z.string().min(1),
  platform: z.string().min(1),
  text: z.string().default(''),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const allowed = await checkRateLimit(ip);
  if (!allowed) return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { api_key_hash, action, platform, text } = parsed.data;

  const keyRecord = await validateApiKeyHash(api_key_hash);
  if (!keyRecord) {
    await writeLog({ apiKeyId: 'unknown', userId: 'unknown', action, platform, result: 'BLOCKED_INVALID_KEY' });
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
  }

  const token = await issueToken({ userId: keyRecord.user_id, apiKeyId: keyRecord.id, scope: keyRecord.scope });
  const decoded = await verifyToken(token);
  if (await isTokenRevoked(decoded.jti)) {
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
  }

  if (!verifyScope(action, keyRecord.scope)) {
    await writeLog({ apiKeyId: keyRecord.id, userId: keyRecord.user_id, action, platform, result: 'BLOCKED_SCOPE' });
    return NextResponse.json({ error: 'action_not_permitted' }, { status: 403 });
  }

  const ruleCheck = await checkGlobalRules({ action, text });
  if (ruleCheck.blocked) {
    await writeLog({ apiKeyId: keyRecord.id, userId: keyRecord.user_id, action, platform, result: 'BLOCKED_RULE', ruleViolated: ruleCheck.ruleViolated });
    return NextResponse.json({ error: 'action_not_permitted' }, { status: 403 });
  }

  await writeLog({ apiKeyId: keyRecord.id, userId: keyRecord.user_id, action, platform, result: 'SUCCESS' });
  return NextResponse.json({ token, userId: keyRecord.user_id, scope: keyRecord.scope });
}
