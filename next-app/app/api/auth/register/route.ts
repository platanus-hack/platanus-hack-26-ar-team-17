import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { getProfileByUserId, createProfile } from '@/lib/services/profile.service';
import { createVerificationSession } from '@/lib/services/didit.service';
import { config } from '@/lib/config';

const bodySchema = z.object({ supabase_access_token: z.string().min(1) });

export async function POST(req: NextRequest) {
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

  if (await getProfileByUserId(user.id)) {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  if (!config.DIDIT_KYC_WORKFLOW_ID) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  try {
    const session = await createVerificationSession({
      userId: user.id,
      workflowId: config.DIDIT_KYC_WORKFLOW_ID,
      callbackUrl: `${config.SITE_URL}/auth/didit-callback?intent=register`,
    });

    await createProfile({
      user_id: user.id,
      email: user.email ?? '',
      google_sub: (user.user_metadata?.sub as string) ?? null,
      full_name: (user.user_metadata?.full_name as string) ?? null,
      picture_url: (user.user_metadata?.avatar_url as string) ?? null,
      dni: null,
      didit_kyc_session_id: session.session_id,
      verification_status: 'PENDING',
    });

    return NextResponse.json(
      { verification_url: session.url, session_id: session.session_id },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('duplicate key value')) {
      if (msg.includes('users_email_key')) {
        return NextResponse.json({ error: 'email_taken' }, { status: 409 });
      }
      if (msg.includes('users_auth_user_id_key') || msg.includes('users_google_sub_key')) {
        return NextResponse.json({ error: 'already_registered' }, { status: 409 });
      }
      return NextResponse.json({ error: 'duplicate' }, { status: 409 });
    }
    console.error('register error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
