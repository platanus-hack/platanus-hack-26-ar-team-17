import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { getAuthUserId } from '@/lib/auth';
import { supabase } from '@/lib/db/supabase';

const registerBody = z.object({
  name: z.string().min(1).max(100),
  platform: z.string().min(1).max(50),
  publicKey: z.string().regex(/^[0-9a-f]{64}$/i, 'publicKey must be a 64-char hex string (32-byte Ed25519 public key)'),
  scope: z.array(z.string()).optional().default([]),
});

export async function POST(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = registerBody.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, platform, publicKey, scope } = parsed.data;
  const did = `did:zero:${crypto.randomUUID()}`;

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({ user_id: userId, name, platform, scope, public_key: publicKey, did })
    .select('id, did')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'public_key_already_registered' }, { status: 409 });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ agentId: agent.id, did: agent.did }, { status: 201 });
}
