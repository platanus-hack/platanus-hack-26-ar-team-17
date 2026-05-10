import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createAgent } from '@/lib/services/agent.service';
import { getProfileByUserId } from '@/lib/services/profile.service';
import { supabase } from '@/lib/db/supabase';
import { ALLOWED_ACTIONS } from '@/lib/services/scope.service';
import { normalizeAction } from '@/lib/utils/normalize';

const PLATFORMS = ['mcp', 'whatsapp', 'telegram', 'slack', 'api', 'custom'] as const;

const createBody = z
  .object({
    name: z.string().min(1).max(100),
    platform: z.enum(PLATFORMS).default('custom'),
    scope: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scope !== undefined && data.scope.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'scope_empty' });
    }
    const scopes = data.scope ?? [];
    for (const s of scopes) {
      if (!ALLOWED_ACTIONS.has(normalizeAction(s))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_scope' });
      }
    }
  });

export async function GET(req: NextRequest) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const profile = await getProfileByUserId(authUserId);
  if (!profile) return NextResponse.json({ error: 'not_registered' }, { status: 404 });

  const { data: rows, error } = await supabase
    .from('api_keys')
    .select(
      'id, name, prefix, scope, status, created_at, revoked_at, agents!inner(platform, user_id)',
    )
    .eq('agents.user_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'internal' }, { status: 500 });

  const keys = (rows ?? []).map((row) => {
    const r = row as unknown as ApiKeyRow;
    const platform = r.agents?.platform ?? 'custom';
    const { agents: _a, ...rest } = r;
    return { ...rest, platform };
  });

  return NextResponse.json(keys);
}

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scope: string[];
  status: string;
  created_at: string;
  revoked_at?: string | null;
  agents?: { platform: string; user_id: string };
};

export async function POST(req: NextRequest) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const profile = await getProfileByUserId(authUserId);
  if (!profile) return NextResponse.json({ error: 'not_registered' }, { status: 404 });
  if (profile.verification_status !== 'APPROVED') {
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

  const keyScope = parsed.data.scope ?? Array.from(ALLOWED_ACTIONS);

  const { agent, key } = await createAgent({
    userId: profile.id,
    name: parsed.data.name,
    type: 'agent',
    platform: parsed.data.platform,
    keyName: parsed.data.name,
    keyScope,
  });

  if (!key) {
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  return NextResponse.json(
    {
      id: key.id,
      plainKey: key.plainKey,
      prefix: key.prefix,
      agent_id: agent.id,
    },
    { status: 201 },
  );
}
