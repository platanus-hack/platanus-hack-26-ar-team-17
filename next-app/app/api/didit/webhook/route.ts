import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignatureV2 } from '@/lib/services/didit.service';
import { updateProfileFromKycResult } from '@/lib/services/profile.service';
import { getLoginAttempt, markLoginAttemptDecision } from '@/lib/services/loginAttempt.service';
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

  console.log('[webhook] session_id:', session_id, 'workflow_id:', workflow_id, 'status:', status);

  // Check if this session belongs to a login attempt first — takes priority over
  // workflow_id matching, which breaks when biometric and KYC share the same workflow.
  const loginAttempt = await getLoginAttempt(session_id);
  if (loginAttempt) {
    console.log('[webhook] matched login attempt, marking:', finalStatus);
    await markLoginAttemptDecision(session_id, finalStatus);
    return NextResponse.json({ ok: true });
  }

  if (workflow_id === config.DIDIT_KYC_WORKFLOW_ID || workflow_id === config.DIDIT_WORKFLOW_ID) {
    console.log('[webhook] matched KYC workflow, updating profile for vendor_data:', vendor_data);
    await updateProfileFromKycResult(vendor_data, {
      dni: isApproved ? (decision?.kyc?.document_number ?? '') : '',
      full_name: isApproved ? (decision?.kyc?.full_name ?? null) : null,
      verification_status: finalStatus,
    });
  } else if (workflow_id === config.DIDIT_BIOMETRIC_WORKFLOW_ID) {
    console.log('[webhook] matched biometric workflow but no login attempt found for session');
  }

  return NextResponse.json({ ok: true });
}
