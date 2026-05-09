import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { hashApiKey } from '@/lib/utils/crypto';

const bodySchema = z.object({
  token:     z.string().min(1),  // the api key (plain) — we hash here
  hash:      z.string().min(1),  // user hash
  action:    z.string().min(1),
  platform:  z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ allowed: false }, { status: 200 }); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ allowed: false }, { status: 200 });

  const { token, hash, action, platform } = parsed.data;
  const keyHash = hashApiKey(token);

  const { data } = await supabase
    .from('api_keys')
    .select('id, agent_id, status, agents!inner(user_id, status, users!inner(hash))')
    .eq('key_hash', keyHash)
    .single<{ id: string; agent_id: string; status: string; agents: { user_id: string; status: string; users: { hash: string } } }>();

  const allowed =
    !!data &&
    data.status === 'ACTIVE' &&
    data.agents?.status === 'ACTIVE' &&
    data.agents?.users?.hash === hash;

  // fire-and-forget audit log (doesn't block response)
  if (allowed && data) {
    void supabase.from('audit_logs').insert({
      agent_id:   data.agent_id,
      api_key_id: data.id,
      user_id:    data.agents.user_id,
      action,
      platform,
      result:     'SUCCESS',
      checksum:   '',
      prev_checksum: '',
    });
  }

  return NextResponse.json({ allowed });
}
