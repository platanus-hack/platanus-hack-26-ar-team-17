import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createAgent, listAgents } from '@/lib/services/agent.service';
import { resolveInternalUserId } from '@/lib/services/profile.service';

const createBody = z.object({
  name: z.string().min(1).max(100),
  platform: z.string().min(1).max(50),
  type: z.enum(['agent', 'mcp']),
});

export async function GET(req: NextRequest) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = await resolveInternalUserId(authUserId);
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 404 });

  const agents = await listAgents(userId);
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = await resolveInternalUserId(authUserId);
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 404 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = createBody.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const result = await createAgent({ userId, ...parsed.data });
  return NextResponse.json(result, { status: 201 });
}
