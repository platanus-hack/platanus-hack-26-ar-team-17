import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { revokeToken, verifyToken } from '@/lib/services/token.service';
import { getProfileByUserId, createProfile } from '@/lib/services/profile.service';
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
  if (user.app_metadata?.provider !== 'google') {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const profile = await getProfileByUserId(user.id);

  // New user → run KYC (id + face) and bootstrap a profile in PENDING state.
  if (!profile) {
    const kycWorkflowId = config.DIDIT_KYC_WORKFLOW_ID ?? config.DIDIT_WORKFLOW_ID;
    if (!kycWorkflowId) {
      return NextResponse.json({ error: 'misconfigured', missing: 'DIDIT_KYC_WORKFLOW_ID' }, { status: 500 });
    }
    try {
      const kycSession = await createVerificationSession({
        userId: user.id,
        workflowId: kycWorkflowId,
        callbackUrl: `${config.SITE_URL}/auth/didit-callback?intent=register`,
      });
      await createProfile({
        user_id: user.id,
        email: user.email ?? '',
        google_sub: (user.user_metadata?.sub as string) ?? null,
        full_name: (user.user_metadata?.full_name as string) ?? null,
        picture_url: (user.user_metadata?.avatar_url as string) ?? null,
        dni: null,
        didit_kyc_session_id: kycSession.session_id,
        verification_status: 'PENDING',
      });
      return NextResponse.json(
        { mode: 'kyc', verification_url: kycSession.url, session_id: kycSession.session_id },
        { status: 201 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key value')) {
        return NextResponse.json({ error: 'duplicate' }, { status: 409 });
      }
      console.error('login (kyc bootstrap) error:', err);
      return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
  }

  // Existing user, KYC not yet approved.
  if (profile.verification_status !== 'APPROVED') {
    return NextResponse.json({ error: 'verification_pending' }, { status: 409 });
  }

  // Returning approved user → biometric face check only.
  // Falls back to KYC workflow if no dedicated biometric workflow is configured.
  const biometricWorkflowId =
    config.DIDIT_BIOMETRIC_WORKFLOW_ID ?? config.DIDIT_KYC_WORKFLOW_ID ?? config.DIDIT_WORKFLOW_ID;
  if (!biometricWorkflowId) {
    return NextResponse.json({ error: 'misconfigured', missing: 'DIDIT_BIOMETRIC_WORKFLOW_ID' }, { status: 500 });
  }

  const session = await createVerificationSession({
    userId: user.id,
    workflowId: biometricWorkflowId,
    callbackUrl: `${config.SITE_URL}/auth/didit-callback?intent=login`,
  });

  await createPendingLoginAttempt(session.session_id, user.id);

  return NextResponse.json({
    mode: 'biometric',
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
