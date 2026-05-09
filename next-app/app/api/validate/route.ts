import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/db/supabase';
import { hashApiKey } from '@/lib/utils/crypto';
import { writeLog } from '@/lib/services/auditLog.service';

const bodySchema = z.object({
  token:    z.string().min(1),
  hash:     z.string().min(1),
  action:   z.string().min(1),
  platform: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ allowed: false }); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ allowed: false });

  const { token, hash, action, platform } = parsed.data;
  const keyHash = hashApiKey(token);

  const { data } = await supabase
    .from('api_keys')
    .select('id, agent_id, status, agents!inner(user_id, status, users!inner(hash))')
    .eq('key_hash', keyHash)
    .single<{
      id: string;
      agent_id: string;
      status: string;
      agents: { user_id: string; status: string; users: { hash: string } };
    }>();

  const allowed =
    !!data &&
    data.status === 'ACTIVE' &&
    data.agents?.status === 'ACTIVE' &&
    data.agents?.users?.hash === hash;

  if (allowed && data) {
    void writeLog({
      agentId: data.agent_id,
      apiKeyId: data.id,
      userId: data.agents.user_id,
      action,
      platform,
      result: 'SUCCESS',
    });
  } else {
    void writeLog({
      agentId: data?.agent_id ?? null,
      apiKeyId: data?.id ?? null,
      userId: data?.agents?.user_id ?? null,
      action,
      platform,
      result: 'BLOCKED_INVALID_KEY',
    });
  }

  return NextResponse.json({ allowed });
}
