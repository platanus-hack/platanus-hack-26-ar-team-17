import { NextRequest, NextResponse } from 'next/server';
import { getInternalUserId } from '@/lib/auth';
import { disableAgent, getAgentWithKeys } from '@/lib/services/agent.service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await getAgentWithKeys(id, me.internalId, me.userHash);
  if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  await disableAgent(id, me.internalId);
  return NextResponse.json({ success: true });
}
