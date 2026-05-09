import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth';
import { createAgent, listAgents, AgentType } from '@/lib/services/agent.service';

const createBody = z.object({
  name: z.string().min(1).max(100),
  platform: z.string().min(1).max(50),
  type: z.enum(['agent', 'mcp']).default('agent'),
});

export async function GET(req: NextRequest) {
  const userId = getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const agents = await listAgents(userId);
  return NextResponse.json(agents);
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

  const result = await createAgent({
    userId,
    name: parsed.data.name,
    type: parsed.data.type as AgentType,
    platform: parsed.data.platform,
  });
  return NextResponse.json(result, { status: 201 });
}
