import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { getLoginAttempt } from '@/lib/services/loginAttempt.service';
import {
  getProfileByUserId,
  getSessionFieldsForAuthUser,
  updateProfileFromKycResult,
} from '@/lib/services/profile.service';
import { issueUserToken } from '@/lib/services/token.service';
import { setSessionCookie } from '@/lib/cookies';
import { DiditSessionDetails, getSession } from '@/lib/services/didit.service';

const querySchema = z.object({
  intent: z.enum(['login', 'register']),
  session_id: z.string().min(1),
  supabase_access_token: z.string().optional(),
});

async function approveResponse(userId: string): Promise<NextResponse> {
  const token = await issueUserToken(userId);
  const fields = await getSessionFieldsForAuthUser(userId);
  const res = NextResponse.json(
    {
      ok: true,
      token,
      userId,
      kycStatus: fields?.kycStatus ?? 'PENDING',
      displayName: fields?.displayName ?? 'Account',
    },
    { status: 200 },
  );
  setSessionCookie(res, token);
  return res;
}

/**
 * Apply a Didit session's verdict to a profile. Returns the final verification
 * status, or null if Didit hasn't reached a terminal state yet.
 */
async function applyDiditDecision(
  session: DiditSessionDetails,
  authUserId: string,
): Promise<'APPROVED' | 'REJECTED' | null> {
  if (session.status !== 'Approved' && session.status !== 'Declined' && session.status !== 'Abandoned') {
    return null;
  }
  const kycDecision = session.decision?.kyc as
    | { document_number?: string; full_name?: string }
    | undefined;
  const documentNumber = kycDecision?.document_number ?? session.kyc?.document_number ?? '';
  const fullName = kycDecision?.full_name ?? session.kyc?.full_name ?? null;
  const verification_status = session.status === 'Approved' ? 'APPROVED' : 'REJECTED';

  await updateProfileFromKycResult(authUserId, {
    dni: verification_status === 'APPROVED' ? documentNumber : '',
    full_name: verification_status === 'APPROVED' ? fullName : null,
    verification_status,
  });

  return verification_status;
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  if (parsed.data.intent === 'login') {
    const attempt = await getLoginAttempt(parsed.data.session_id);
    if (!attempt) return NextResponse.json({ status: 'pending' }, { status: 202 });
    if (attempt.decision === 'APPROVED') return approveResponse(attempt.user_id);
    if (attempt.decision === 'REJECTED') return NextResponse.json({ error: 'rejected' }, { status: 410 });
    return NextResponse.json({ status: 'pending' }, { status: 202 });
  }

  // intent === 'register'
  // Identify the user authoritatively via Didit. We set vendor_data = auth_user_id
  // when we created the session, so Didit's response is the source of truth and
  // works even when the local profile didn't capture the session id.
  let authUserId: string | null = null;
  let diditSession: DiditSessionDetails | null = null;

  try {
    diditSession = await getSession(parsed.data.session_id);
    if (diditSession?.vendor_data) authUserId = diditSession.vendor_data;
    console.log('[finalize] didit session', parsed.data.session_id, 'status:', diditSession?.status, 'vendor_data:', diditSession?.vendor_data);
  } catch (err) {
    console.warn('[finalize] failed to fetch Didit session', parsed.data.session_id, err);
  }

  // Fall back to Supabase token if Didit didn't return a vendor_data we can use.
  if (!authUserId && parsed.data.supabase_access_token) {
    const { data: userResult, error } = await supabase.auth.getUser(parsed.data.supabase_access_token);
    if (error || !userResult?.user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    authUserId = userResult.user.id;
  }

  if (!authUserId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const profile = await getProfileByUserId(authUserId);
  if (!profile) {
    console.warn('[finalize] no profile found for user:', authUserId);
    return NextResponse.json({ status: 'pending' }, { status: 202 });
  }
  if (profile.verification_status === 'APPROVED') return approveResponse(profile.user_id);
  if (profile.verification_status === 'REJECTED') return NextResponse.json({ error: 'rejected' }, { status: 410 });

  // Apply Didit's verdict if we already have it; otherwise the profile is still pending.
  if (diditSession) {
    const syncedStatus = await applyDiditDecision(diditSession, authUserId);
    if (syncedStatus === 'APPROVED') return approveResponse(authUserId);
    if (syncedStatus === 'REJECTED') return NextResponse.json({ error: 'rejected' }, { status: 410 });
  }

  return NextResponse.json({ status: 'pending' }, { status: 202 });
}
