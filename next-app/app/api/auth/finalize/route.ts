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
import { getSession } from '@/lib/services/didit.service';

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

async function syncKycStatusFromDidit(sessionId: string, authUserId: string) {
  try {
    const session = await getSession(sessionId);
    console.log('[finalize] didit session:', sessionId, 'status:', session.status);
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
  } catch (err) {
    console.error('[finalize] syncKycStatusFromDidit error:', err);
    return null;
  }
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

  // intent === 'register' — needs the Supabase token to identify the user
  if (!parsed.data.supabase_access_token) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { data: userResult, error } = await supabase.auth.getUser(parsed.data.supabase_access_token);
  if (error || !userResult?.user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });

  const profile = await getProfileByUserId(userResult.user.id);
  if (!profile) {
    console.warn('[finalize] no profile found for user:', userResult.user.id);
    return NextResponse.json({ status: 'pending' }, { status: 202 });
  }
  if (profile.verification_status === 'APPROVED') return approveResponse(profile.user_id);
  if (profile.verification_status === 'REJECTED') return NextResponse.json({ error: 'rejected' }, { status: 410 });

  const syncedStatus = await syncKycStatusFromDidit(parsed.data.session_id, userResult.user.id);
  if (syncedStatus === 'APPROVED') return approveResponse(userResult.user.id);
  if (syncedStatus === 'REJECTED') return NextResponse.json({ error: 'rejected' }, { status: 410 });

  return NextResponse.json({ status: 'pending' }, { status: 202 });
}
