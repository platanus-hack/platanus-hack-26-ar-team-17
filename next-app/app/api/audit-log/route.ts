import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInternalUserId } from '@/lib/auth';
import { supabase } from '@/lib/db/supabase';

const querySchema = z.object({
  agentId: z.string().uuid().optional(),
  keyId: z.string().optional(),
  platform: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  result: z
    .enum([
      'SUCCESS',
      'BLOCKED_INVALID_KEY',
      'BLOCKED_SCOPE',
      'BLOCKED_RULE',
      'BLOCKED_REVOKED',
    ])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { agentId, keyId, platform, from, to, result, page, limit } = parsed.data;
  const size = limit ?? PAGE_SIZE;

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', me.internalId)
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (agentId) query = query.eq('agent_id', agentId);
  if (keyId) query = query.eq('api_key_id', keyId);
  if (platform) query = query.eq('platform', platform);
  if (result) query = query.eq('result', result);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data: logs } = await query;
  return NextResponse.json(logs ?? []);
}
