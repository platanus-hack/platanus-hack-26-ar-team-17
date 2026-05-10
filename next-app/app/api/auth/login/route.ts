import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { revokeToken, verifyToken } from '@/lib/services/token.service';
import { getProfileByUserId, createProfile, getSessionFieldsForAuthUser, updateProfileFromKycResult } from '@/lib/services/profile.service';
import { createVerificationSession } from '@/lib/services/didit.service';
import { clearSessionCookie, setSessionCookie, APP_SESSION_COOKIE } from '@/lib/cookies';
import { checkRateLimit } from '@/lib/rateLimiter';
import { issueUserToken } from '@/lib/services/token.service';
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

  // Returning approved user → log in directly, no Didit needed.
  if (profile?.verification_status === 'APPROVED') {
    const token = await issueUserToken(user.id);
    const fields = await getSessionFieldsForAuthUser(user.id);
    const res = NextResponse.json({
      mode: 'direct',
      token,
      userId: user.id,
      kycStatus: fields?.kycStatus ?? 'VERIFIED',
      displayName: fields?.displayName ?? 'Account',
    });
    setSessionCookie(res, token);
    return res;
  }

  // DIDIT_MOCK: skip KYC entirely and approve the user immediately.
  // Read process.env directly (not config) so tests can toggle it per-test.
  if (process.env.DIDIT_MOCK) {
    if (!profile) {
      await createProfile({
        user_id: user.id,
        email: user.email ?? '',
        google_sub: (user.user_metadata?.sub as string) ?? null,
        full_name: (user.user_metadata?.full_name as string) ?? null,
        picture_url: (user.user_metadata?.avatar_url as string) ?? null,
        dni: null,
        didit_kyc_session_id: 'mock',
        verification_status: 'APPROVED',
      });
    } else {
      await updateProfileFromKycResult(user.id, {
        dni: profile.dni ?? 'mock',
        full_name: profile.full_name,
        verification_status: 'APPROVED',
      });
    }
    const token = await issueUserToken(user.id);
    const fields = await getSessionFieldsForAuthUser(user.id);
    const res = NextResponse.json({
      mode: 'direct',
      token,
      userId: user.id,
      kycStatus: 'VERIFIED',
      displayName: fields?.displayName ?? user.email ?? 'Account',
    });
    setSessionCookie(res, token);
    return res;
  }

  // New user → create profile + start KYC.
  const kycWorkflowId = config.DIDIT_KYC_WORKFLOW_ID ?? config.DIDIT_WORKFLOW_ID;
  if (!kycWorkflowId) {
    return NextResponse.json({ error: 'misconfigured', missing: 'DIDIT_KYC_WORKFLOW_ID' }, { status: 500 });
  }

  if (!profile) {
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
        didit_kyc_session_url: kycSession.url,
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

  // Existing user still pending KYC → always create a fresh session (old ones may be expired).
  try {
    const kycSession = await createVerificationSession({
      userId: user.id,
      workflowId: kycWorkflowId,
      callbackUrl: `${config.SITE_URL}/auth/didit-callback?intent=register`,
    });
    await supabase
      .from('users')
      .update({
        didit_session_id: kycSession.session_id,
        didit_session_url: kycSession.url,
        kyc_status: 'PENDING',
      })
      .eq('id', profile.id);
    return NextResponse.json({
      mode: 'kyc',
      verification_url: kycSession.url,
      session_id: kycSession.session_id,
    });
  } catch (err) {
    console.error('login (kyc resume) error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
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
