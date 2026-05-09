import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createApiKey } from '@/lib/services/apiKey.service';
import { supabase } from '@/lib/db/supabase';

const PLATFORMS = ['mcp', 'whatsapp', 'telegram', 'slack', 'api', 'custom'] as const;

const createBody = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(PLATFORMS).default('custom'),
  scope: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, platform, prefix, scope, status, created_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return NextResponse.json(keys ?? []);
}

export async function POST(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: user } = await supabase.from('users').select('kyc_status').eq('id', userId).single();
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

  const result = await createApiKey({ userId, name: parsed.data.name, platform: parsed.data.platform, scope: parsed.data.scope });
  return NextResponse.json(result, { status: 201 });
}
