import { NextRequest, NextResponse } from 'next/server';
import { getInternalUserId } from '@/lib/auth';
import { revokeApiKey } from '@/lib/services/apiKey.service';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getInternalUserId(req);
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  await revokeApiKey(id, me.internalId);
  return NextResponse.json({ success: true });
}
