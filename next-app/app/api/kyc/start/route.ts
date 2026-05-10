import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { supabase } from '@/lib/db/supabase';
import { createVerificationSession } from '@/lib/services/didit.service';
import { config } from '@/lib/config';

const CALLBACK_PATH = '/';

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: user } = await supabase
    .from('users')
    .select('id, kyc_status, didit_session_url')
    .eq('auth_user_id', userId)
    .single();

  if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (user.kyc_status === 'VERIFIED') {
    return NextResponse.json({ error: 'already_verified' }, { status: 409 });
  }

  if (user.didit_session_url && user.kyc_status !== 'REJECTED') {
    return NextResponse.json({ url: user.didit_session_url, resumed: true });
  }

  let session;
  try {
    session = await createVerificationSession({
      userId,
      callbackUrl: `${config.SITE_URL.replace(/\/$/, '')}${CALLBACK_PATH}`,
    });
  } catch {
    return NextResponse.json({ error: 'didit_session_failed' }, { status: 502 });
  }

  await supabase
    .from('users')
    .update({
      didit_session_id: session.session_id,
      didit_session_url: session.url,
      kyc_status: 'IN_REVIEW',
    })
    .eq('id', user.id);

  return NextResponse.json({ url: session.url, session_id: session.session_id }, { status: 201 });
}
