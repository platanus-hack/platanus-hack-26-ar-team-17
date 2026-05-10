import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { disableAgent, getAgent } from '@/lib/services/agent.service';

const revokeBody = z.object({
  agentId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = revokeBody.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { agentId } = parsed.data;

  const owned = await getAgent(agentId, userId);
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (owned.status === 'DISABLED') {
    return NextResponse.json({ error: 'already_revoked' }, { status: 409 });
  }

  await disableAgent(agentId, userId);
  const revokedAt = new Date().toISOString();

  return NextResponse.json({ revoked: true, agentId, revokedAt });
}
