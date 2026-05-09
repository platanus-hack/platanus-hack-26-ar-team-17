import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createApiKey } from '@/lib/services/apiKey.service';
import { getAgent } from '@/lib/services/agent.service';
import { supabase } from '@/lib/db/supabase';

const createBody = z.object({
  agent_id: z.string().uuid(),
  name: z.string().min(1).max(100).default('rotated'),
});

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get('agent_id');

  let query = supabase
    .from('api_keys')
    .select('id, agent_id, name, prefix, status, created_at, revoked_at, agents!inner(user_id)')
    .eq('agents.user_id', userId)
    .order('created_at', { ascending: false });

  if (agentId) query = query.eq('agent_id', agentId);

  const { data: keys } = await query;
  return NextResponse.json(keys ?? []);
}

export async function POST(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = createBody.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const owned = await getAgent(parsed.data.agent_id, userId);
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const result = await createApiKey({ agentId: parsed.data.agent_id, name: parsed.data.name });
  return NextResponse.json(result, { status: 201 });
}
