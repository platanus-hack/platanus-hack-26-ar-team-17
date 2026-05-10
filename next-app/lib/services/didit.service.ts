import crypto from 'crypto';

const DIDIT_API_URL = process.env.DIDIT_API_URL ?? 'https://verification.didit.me';
const SIGNATURE_TOLERANCE_SECONDS = 300;

export type DiditStatus =
  | 'Not Started'
  | 'In Progress'
  | 'In Review'
  | 'Approved'
  | 'Declined'
  | 'Abandoned';

export interface CreateSessionResponse {
  session_id: string;
  url: string;
  status: string;
}

export interface DiditWebhookPayload {
  session_id: string;
  status: DiditStatus;
  webhook_type: string;
  created_at: number;
  timestamp: number;
  workflow_id: string;
  vendor_data?: string;
  metadata?: Record<string, unknown>;
  decision?: Record<string, unknown>;
}

export interface DiditSessionDetails {
  session_id: string;
  status: DiditStatus;
  workflow_id: string;
  vendor_data?: string;
  decision?: Record<string, unknown>;
  kyc?: { document_number?: string; full_name?: string };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function createVerificationSession(params: {
  userId: string;
  callbackUrl: string;
  workflowId?: string; // override default for biometric flows
  portraitImage?: string; // base64-encoded reference image for biometric face match
}): Promise<CreateSessionResponse> {
  const apiKey = requireEnv('DIDIT_API_KEY');
  const workflowId = params.workflowId ?? requireEnv('DIDIT_WORKFLOW_ID');

  const body: Record<string, unknown> = {
    workflow_id: workflowId,
    vendor_data: params.userId,
    callback: params.callbackUrl,
  };
  if (params.portraitImage) body.portrait_image = params.portraitImage;

  const res = await fetch(`${DIDIT_API_URL}/v3/session/`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Didit createSession failed: ${res.status} ${text.slice(0, 200)}`);
  }

  return (await res.json()) as CreateSessionResponse;
}

export async function getSession(sessionId: string): Promise<DiditSessionDetails> {
  const apiKey = requireEnv('DIDIT_API_KEY');
  const res = await fetch(`${DIDIT_API_URL}/v3/session/${sessionId}/`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Didit getSession failed: ${res.status}`);
  return (await res.json()) as DiditSessionDetails;
}

export interface DiditDecision {
  session_id: string;
  status: string;
  id_verifications?: Array<{ portrait_image?: string; [k: string]: unknown }>;
  [k: string]: unknown;
}

export async function getDecision(sessionId: string): Promise<DiditDecision> {
  const apiKey = requireEnv('DIDIT_API_KEY');
  const res = await fetch(`${DIDIT_API_URL}/v3/session/${sessionId}/decision/`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Didit getDecision failed: ${res.status}`);
  return (await res.json()) as DiditDecision;
}

// Pulls the portrait image captured during a prior KYC session and returns
// it as base64 — the format Didit expects for biometric `portrait_image`.
export async function getKycPortraitAsBase64(kycSessionId: string): Promise<string | null> {
  const decision = await getDecision(kycSessionId);
  const portraitUrl = decision.id_verifications?.[0]?.portrait_image;
  if (!portraitUrl) return null;
  const res = await fetch(portraitUrl);
  if (!res.ok) throw new Error(`Failed to fetch portrait: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64');
}

function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalJSON((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

export interface SignatureVerifyParams {
  rawBody: string;
  signatureHeader: string | null;
  timestampHeader: string | null;
  secret?: string;
  now?: number;
}

export function verifyWebhookSignatureV2(params: SignatureVerifyParams): boolean {
  const { rawBody, signatureHeader, timestampHeader } = params;
  if (!signatureHeader || !timestampHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;

  const now = params.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const secret = params.secret ?? requireEnv('DIDIT_WEBHOOK_SECRET');

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const canonical = canonicalJSON(parsed);
  const expected = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signatureHeader, 'hex');
  } catch {
    return false;
  }
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function mapDiditStatusToKyc(status: DiditStatus): 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' {
  switch (status) {
    case 'Approved':
      return 'VERIFIED';
    case 'Declined':
    case 'Abandoned':
      return 'REJECTED';
    case 'In Review':
      return 'IN_REVIEW';
    case 'Not Started':
    case 'In Progress':
    default:
      return 'PENDING';
  }
}
