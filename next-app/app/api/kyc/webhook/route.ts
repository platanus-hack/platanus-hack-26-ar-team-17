import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/supabase';
import {
  DiditWebhookPayload,
  mapDiditStatusToKyc,
  verifyWebhookSignatureV2,
} from '@/lib/services/didit.service';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-signature-v2');
  const timestampHeader = req.headers.get('x-timestamp');

  const valid = verifyWebhookSignatureV2({
    rawBody,
    signatureHeader,
    timestampHeader,
  });
  if (!valid) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });

  let payload: DiditWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DiditWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  if (!payload.session_id || !payload.status) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const newStatus = mapDiditStatusToKyc(payload.status);
  const update: Record<string, unknown> = { kyc_status: newStatus };
  if (newStatus === 'VERIFIED') update.kyc_verified_at = new Date().toISOString();

  const { error } = await supabase.from('users').update(update).eq('didit_session_id', payload.session_id);
  if (error) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
