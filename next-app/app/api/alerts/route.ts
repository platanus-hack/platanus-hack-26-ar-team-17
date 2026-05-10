import { NextRequest, NextResponse } from 'next/server';
import { getInternalUserId } from '@/lib/auth';
import { supabase } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: alerts } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', me.internalId)
    .eq('result', 'BLOCKED_RULE')
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(alerts ?? []);
}
