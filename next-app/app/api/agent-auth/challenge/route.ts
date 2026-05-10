import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createChallenge, ChallengeError } from '@/lib/services/challenge.service';

const challengeBody = z.object({
  agentId: z.string().uuid(),
  requestedAction: z.string().min(1).max(200),
  platform: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = challengeBody.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createChallenge(
      parsed.data.agentId,
      parsed.data.requestedAction,
      parsed.data.platform,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ChallengeError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
