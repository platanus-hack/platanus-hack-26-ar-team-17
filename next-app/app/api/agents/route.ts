import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInternalUserId } from '@/lib/auth';
import { createAgent, listAgentsWithMcpUrl, type AgentType, getMcpUrl } from '@/lib/services/agent.service';
import { config } from '@/lib/config';

const createBody = z.object({
  name: z.string().min(1).max(100),
  platform: z.string().min(1).max(50),
  type: z.enum(['agent', 'mcp']).default('agent'),
});

export async function GET(req: NextRequest) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const agents = await listAgentsWithMcpUrl(me.internalId, me.userHash);
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const parsed = createBody.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const result = await createAgent({
    userId: me.internalId,
    name: parsed.data.name,
    type: parsed.data.type as AgentType,
    platform: parsed.data.platform,
  });

  const mcp_url =
    result.agent.type === 'mcp' && me.userHash
      ? getMcpUrl(me.userHash, result.agent.id, config.SITE_URL)
      : null;

  return NextResponse.json(
    { ...result, agent: { ...result.agent, mcp_url } },
    { status: 201 },
  );
}
