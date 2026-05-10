import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { disableAgent } from '@/lib/services/agent.service';
import { resolveInternalUserId } from '@/lib/services/profile.service';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const userId = await resolveInternalUserId(authUserId);
  if (!userId) return NextResponse.json({ error: 'not_registered' }, { status: 404 });

  const { id } = await params;
  await disableAgent(id, userId);
  return NextResponse.json({ success: true });
}
