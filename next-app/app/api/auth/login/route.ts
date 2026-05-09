import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { revokeToken, verifyToken } from '@/lib/services/token.service';
import { getProfileByUserId } from '@/lib/services/profile.service';
import { createVerificationSession } from '@/lib/services/didit.service';
import { createPendingLoginAttempt } from '@/lib/services/loginAttempt.service';
import { clearSessionCookie, APP_SESSION_COOKIE } from '@/lib/cookies';
import { checkRateLimit } from '@/lib/rateLimiter';
import { config } from '@/lib/config';

const bodySchema = z.object({ supabase_access_token: z.string().min(1) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!(await checkRateLimit(ip))) {
    return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { data: userResult, error } = await supabase.auth.getUser(parsed.data.supabase_access_token);
  if (error || !userResult?.user) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = userResult.user;
  console.log('user', user);

  const profile = await getProfileByUserId(user.id);
  if (!profile) return NextResponse.json({ error: 'not_registered', user }, { status: 404});
  if (profile.verification_status !== 'APPROVED') {
    return NextResponse.json({ error: 'verification_pending' }, { status: 409 });
  }

  if (!config.DIDIT_BIOMETRIC_WORKFLOW_ID) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const session = await createVerificationSession({
    userId: user.id,
    workflowId: config.DIDIT_BIOMETRIC_WORKFLOW_ID,
    callbackUrl: `${config.SITE_URL}/auth/didit-callback?intent=login`,
  });

  await createPendingLoginAttempt(session.session_id, user.id);

  return NextResponse.json({
    verification_url: session.url,
    session_id: session.session_id,
  });
}

export async function DELETE(req: NextRequest) {
  const cookieToken = req.cookies.get(APP_SESSION_COOKIE)?.value;
  if (cookieToken) {
    try {
      const decoded = await verifyToken(cookieToken);
      if (decoded.jti) await revokeToken(decoded.jti);
    } catch {
      // ignore
    }
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
