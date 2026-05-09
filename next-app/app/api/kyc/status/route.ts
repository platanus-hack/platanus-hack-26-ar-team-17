import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('users')
    .select('kyc_status, kyc_verified_at, didit_session_url')
    .eq('id', userId)
    .single();

  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    status: data.kyc_status,
    verified_at: data.kyc_verified_at,
    session_url: data.didit_session_url,
  });
}
