import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyChallenge, ChallengeError } from '@/lib/services/challenge.service';

const verifyBody = z.object({
  agentId: z.string().uuid(),
  challengeId: z.string().uuid(),
  signature: z.string().regex(/^[0-9a-f]{128}$/i, 'signature must be a 128-char hex string (64-byte Ed25519 signature)'),
  signaturePqc: z.string().regex(/^[0-9a-f]{6618}$/i, 'signaturePqc must be a 6618-char hex string (3309-byte ML-DSA-65 signature)').optional(),
});

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const parsed = verifyBody.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await verifyChallenge(
      parsed.data.agentId,
      parsed.data.challengeId,
      parsed.data.signature,
      parsed.data.signaturePqc,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ChallengeError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
