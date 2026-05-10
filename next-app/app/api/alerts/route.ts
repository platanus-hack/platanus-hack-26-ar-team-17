import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { supabase } from '@/lib/db/supabase';
import { resolveInternalUserId } from '@/lib/services/profile.service';

export async function GET(req: NextRequest) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = await resolveInternalUserId(authUserId);
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 404 });

  const { data: alerts } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('result', 'BLOCKED_RULE')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(alerts ?? []);
}
