import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignatureV2 } from '@/lib/services/didit.service';
import { updateProfileFromKycResult } from '@/lib/services/profile.service';
import { markLoginAttemptDecision } from '@/lib/services/loginAttempt.service';
import { config } from '@/lib/config';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signatureHeader = req.headers.get('x-signature-v2');
  const timestampHeader = req.headers.get('x-timestamp');
  const valid = verifyWebhookSignatureV2({ rawBody: raw, signatureHeader, timestampHeader });
  console.log('[webhook] sig valid:', valid, 'hasV2:', !!signatureHeader, 'hasTs:', !!timestampHeader);
  if (!valid) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: {
    session_id: string;
    vendor_data: string;
    workflow_id: string;
    status: string;
    decision?: { kyc?: { document_number?: string; full_name?: string } };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const { workflow_id, vendor_data, session_id, status, decision } = payload;
  const isApproved = status === 'Approved';
  const finalStatus = isApproved ? 'APPROVED' : 'REJECTED';

  if (workflow_id === config.DIDIT_KYC_WORKFLOW_ID) {
    await updateProfileFromKycResult(vendor_data, {
      dni: isApproved ? (decision?.kyc?.document_number ?? '') : '',
      full_name: isApproved ? (decision?.kyc?.full_name ?? null) : null,
      verification_status: finalStatus,
    });
  } else if (workflow_id === config.DIDIT_BIOMETRIC_WORKFLOW_ID) {
    await markLoginAttemptDecision(session_id, finalStatus);
  }
  // Unknown workflows are silently OK'd — Didit retries are bounded.

  return NextResponse.json({ ok: true });
}
