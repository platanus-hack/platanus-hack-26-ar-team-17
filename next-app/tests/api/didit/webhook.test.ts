import { POST as webhook } from '@/app/api/didit/webhook/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

jest.mock('@/lib/services/profile.service', () => ({
  updateProfileFromKycResult: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/services/loginAttempt.service', () => ({
  markLoginAttemptDecision: jest.fn().mockResolvedValue(undefined),
}));

const { updateProfileFromKycResult } = require('@/lib/services/profile.service');
const { markLoginAttemptDecision } = require('@/lib/services/loginAttempt.service');

beforeEach(() => jest.clearAllMocks());

const SECRET = 'test-webhook-secret';

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

function sign(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(canonicalJSON(JSON.parse(body))).digest('hex');
}

function makeWebhookReq(body: object, signatureOverride?: string, timestampOverride?: string) {
  const raw = JSON.stringify(body);
  const sig = signatureOverride ?? sign(raw);
  const ts = timestampOverride ?? String(Math.floor(Date.now() / 1000));
  return new NextRequest('http://localhost/api/didit/webhook', {
    method: 'POST',
    body: raw,
    headers: {
      'content-type': 'application/json',
      'x-signature-v2': sig,
      'x-timestamp': ts,
    },
  });
}

describe('POST /api/didit/webhook', () => {
  it('rejects invalid signature', async () => {
    const res = await webhook(makeWebhookReq({ session_id: 's', vendor_data: 'u' }, 'bogus'));
    expect(res.status).toBe(401);
  });

  it('updates profile on KYC approved', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_kyc',
      vendor_data: 'user_1',
      workflow_id: 'kyc-workflow-id',
      status: 'Approved',
      decision: { kyc: { document_number: '12345678', full_name: 'Ada' } },
    }));
    expect(res.status).toBe(200);
    expect(updateProfileFromKycResult).toHaveBeenCalledWith('user_1', {
      dni: '12345678',
      full_name: 'Ada',
      verification_status: 'APPROVED',
    });
  });

  it('marks profile REJECTED on KYC declined', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_kyc',
      vendor_data: 'user_1',
      workflow_id: 'kyc-workflow-id',
      status: 'Declined',
    }));
    expect(res.status).toBe(200);
    expect(updateProfileFromKycResult).toHaveBeenCalledWith('user_1', {
      dni: '',
      full_name: null,
      verification_status: 'REJECTED',
    });
  });

  it('updates login attempt on biometric approved', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_bio',
      vendor_data: 'user_1',
      workflow_id: 'bio-workflow-id',
      status: 'Approved',
    }));
    expect(res.status).toBe(200);
    expect(markLoginAttemptDecision).toHaveBeenCalledWith('sess_bio', 'APPROVED');
  });

  it('updates login attempt on biometric declined', async () => {
    const res = await webhook(makeWebhookReq({
      session_id: 'sess_bio',
      vendor_data: 'user_1',
      workflow_id: 'bio-workflow-id',
      status: 'Declined',
    }));
    expect(res.status).toBe(200);
    expect(markLoginAttemptDecision).toHaveBeenCalledWith('sess_bio', 'REJECTED');
  });
});
