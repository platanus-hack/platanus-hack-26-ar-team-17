import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { countAgentsForUser, createAgent } from '@/lib/services/agent.service';
import { resolveInternalUserIdByHash } from '@/lib/services/profile.service';

const bodySchema = z.object({
  userHash: z.string().min(1).max(256),
  name: z.string().min(1).max(100).optional(),
  platform: z.string().min(1).max(50).optional(),
});

/**
 * Aprovisiona un único agente por usuario identificado por `users.hash`.
 * Pensado para uso desde el CLI local contra un despliegue confiable.
 */
export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const { userHash, name, platform } = parsed.data;
  const userId = await resolveInternalUserIdByHash(userHash);
  if (!userId) return NextResponse.json({ error: 'unknown_user_hash' }, { status: 404 });

  const existing = await countAgentsForUser(userId);
  if (existing > 0) {
    return NextResponse.json(
      { error: 'agent_already_exists', message: 'Este usuario ya tiene al menos un agente.' },
      { status: 409 },
    );
  }

  const result = await createAgent({
    userId,
    name: name ?? 'Agente CLI',
    type: 'agent',
    platform: platform ?? 'cli',
    keyName: 'cli-default',
  });

  return NextResponse.json(
    {
      agent: result.agent,
      apiKey: result.key?.plainKey ?? null,
      keyPrefix: result.key?.prefix ?? null,
    },
    { status: 201 },
  );
}
