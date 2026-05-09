import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createApiKey } from '@/lib/services/apiKey.service';
import { ALLOWED_ACTIONS } from '@/lib/services/scope.service';
import { supabase } from '@/lib/db/supabase';

const createBody = z.object({
  name: z.string().min(1).max(100),
  scope: z.array(z.enum([...ALLOWED_ACTIONS] as [string, ...string[]])).min(1),
});

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, scope, status, created_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return NextResponse.json(keys ?? []);
}

export async function POST(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = createBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const result = await createApiKey({ userId, ...parsed.data });
  return NextResponse.json(result, { status: 201 });
}
