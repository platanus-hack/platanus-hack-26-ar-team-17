import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createAgent } from '@/lib/services/agent.service';
import { supabase } from '@/lib/db/supabase';

const createBody = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(req: NextRequest) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, status, created_at, revoked_at')
    .eq('agents.user_id', authUserId)
    .order('created_at', { ascending: false });

  return NextResponse.json(keys ?? []);
}

export async function POST(req: NextRequest) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: user } = await supabase
    .from('users')
    .select('id, kyc_status')
    .eq('auth_user_id', authUserId)
    .single();

  if (!user || user.kyc_status !== 'VERIFIED') {
    return NextResponse.json({ error: 'kyc_required' }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = createBody.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const result = await createAgent({
    userId: user.id,
    name: parsed.data.name,
    type: 'agent',
    platform: 'mcp',
  });

  if (!result.key) {
    return NextResponse.json({ error: 'key_creation_failed' }, { status: 500 });
  }

  return NextResponse.json(
    { id: result.key.id, plainKey: result.key.plainKey, prefix: result.key.prefix, agentId: result.agent.id },
    { status: 201 },
  );
}
