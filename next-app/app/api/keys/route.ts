import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInternalUserId } from '@/lib/auth';
import { supabase } from '@/lib/db/supabase';
import { getAgent } from '@/lib/services/agent.service';
import { createApiKey } from '@/lib/services/apiKey.service';

const rotateBody = z.object({
  agent_id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  revoked_at: string | null;
  agent_id: string;
  agents: { name: string; platform: string; type: string; user_id: string };
};

export async function GET(req: NextRequest) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const filterAgentId = req.nextUrl.searchParams.get('agent_id');

  let query = supabase
    .from('api_keys')
    .select(
      'id, name, prefix, status, created_at, revoked_at, agent_id, agents!inner(name, platform, type, user_id)',
    )
    .eq('agents.user_id', me.internalId)
    .order('created_at', { ascending: false });

  if (filterAgentId) query = query.eq('agent_id', filterAgentId);

  const { data } = await query;
  const rows = (data ?? []) as unknown as KeyRow[];

  return NextResponse.json(
    rows.map(r => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      status: r.status,
      created_at: r.created_at,
      revoked_at: r.revoked_at,
      agent_id: r.agent_id,
      agent_name: r.agents.name,
      platform: r.agents.platform,
      agent_type: r.agents.type,
    })),
  );
}

// Rotation: add a new key under an existing agent the caller owns.
export async function POST(req: NextRequest) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: user } = await supabase
    .from('users')
    .select('kyc_status')
    .eq('id', me.internalId)
    .single<{ kyc_status: string }>();

  if (!user || user.kyc_status !== 'VERIFIED') {
    return NextResponse.json({ error: 'kyc_required' }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = rotateBody.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const agent = await getAgent(parsed.data.agent_id, me.internalId);
  if (!agent) return NextResponse.json({ error: 'agent_not_found' }, { status: 404 });
  if (agent.type === 'mcp') {
    return NextResponse.json({ error: 'mcp_agents_have_no_keys' }, { status: 400 });
  }

  const key = await createApiKey({ agentId: agent.id, name: parsed.data.name });
  return NextResponse.json(
    { id: key.id, plainKey: key.plainKey, prefix: key.prefix, agent_id: agent.id },
    { status: 201 },
  );
}
