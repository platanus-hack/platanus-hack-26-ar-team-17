import crypto from 'crypto';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

import { POST as startPOST } from '@/app/api/kyc/start/route';
import { POST as webhookPOST } from '@/app/api/kyc/webhook/route';
import { GET as statusGET } from '@/app/api/kyc/status/route';

jest.mock('@/lib/services/token.service', () => ({
  ...jest.requireActual('@/lib/services/token.service'),
  isTokenRevoked: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/lib/services/didit.service', () => {
  const actual = jest.requireActual('@/lib/services/didit.service');
  return {
    ...actual,
    createVerificationSession: jest.fn(),
  };
});
jest.mock('@/lib/db/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const { supabase } = require('@/lib/db/supabase');
const { createVerificationSession } = require('@/lib/services/didit.service');

const JWT_SECRET = 'test-secret-at-least-32-characters-long-hackathon';
const validToken = jwt.sign(
  { userId: 'user_1', type: 'user_session', jti: crypto.randomUUID() },
  JWT_SECRET,
  { expiresIn: '1h' },
);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.DIDIT_WEBHOOK_SECRET = 'shhh';
});

function authReq(path: string, method: string, body?: object) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${validToken}`, 'Content-Type': 'application/json', host: 'localhost:3000' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function mockSelectSingle(result: { data: unknown; error: unknown }) {
  supabase.from.mockReturnValueOnce({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(result),
      }),
    }),
  });
}

function mockUpdate(result: { error: unknown } = { error: null }) {
  supabase.from.mockReturnValueOnce({
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue(result),
    }),
  });
}

describe('POST /api/kyc/start', () => {
  it('returns 401 without a token', async () => {
    const res = await startPOST(new NextRequest('http://localhost/api/kyc/start', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('creates a Didit session and persists it on first call', async () => {
    mockSelectSingle({ data: { id: 'user_1', kyc_status: 'PENDING', didit_session_url: null }, error: null });
    mockUpdate();
    createVerificationSession.mockResolvedValue({
      session_id: 'sess_1',
      url: 'https://verify.example/sess_1',
      status: 'Not Started',
    });

    const res = await startPOST(authReq('/api/kyc/start', 'POST'));
    expect(res.status).toBe(201);
    expect((await res.json()).url).toBe('https://verify.example/sess_1');
    expect(createVerificationSession).toHaveBeenCalledTimes(1);
  });

  it('resumes an existing in-flight session without calling Didit again', async () => {
    mockSelectSingle({
      data: { id: 'user_1', kyc_status: 'IN_REVIEW', didit_session_url: 'https://verify.example/sess_1' },
      error: null,
    });

    const res = await startPOST(authReq('/api/kyc/start', 'POST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://verify.example/sess_1');
    expect(body.resumed).toBe(true);
    expect(createVerificationSession).not.toHaveBeenCalled();
  });

  it('returns 409 when user is already VERIFIED', async () => {
    mockSelectSingle({ data: { id: 'user_1', kyc_status: 'VERIFIED', didit_session_url: null }, error: null });
    const res = await startPOST(authReq('/api/kyc/start', 'POST'));
    expect(res.status).toBe(409);
    expect(createVerificationSession).not.toHaveBeenCalled();
  });

  it('returns 502 when Didit call fails', async () => {
    mockSelectSingle({ data: { id: 'user_1', kyc_status: 'PENDING', didit_session_url: null }, error: null });
    createVerificationSession.mockRejectedValue(new Error('boom'));
    const res = await startPOST(authReq('/api/kyc/start', 'POST'));
    expect(res.status).toBe(502);
  });
});

describe('POST /api/kyc/webhook', () => {
  function canonicalJSON(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
      '{' +
      keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON((value as Record<string, unknown>)[k])).join(',') +
      '}'
    );
  }

  function signedReq(payload: object, opts: { tamperBody?: boolean; badSig?: boolean } = {}) {
    const rawBody = JSON.stringify(payload);
    const signature = opts.badSig
      ? 'a'.repeat(64)
      : crypto.createHmac('sha256', 'shhh').update(canonicalJSON(payload)).digest('hex');
    const body = opts.tamperBody ? rawBody + ' ' : rawBody;
    return new NextRequest('http://localhost/api/kyc/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-v2': signature,
        'x-timestamp': String(Math.floor(Date.now() / 1000)),
      },
      body,
    });
  }

  it('rejects requests with an invalid signature', async () => {
    const res = await webhookPOST(signedReq({ session_id: 's', status: 'Approved' }, { badSig: true }));
    expect(res.status).toBe(401);
  });

  it('updates user to VERIFIED on Approved + sets kyc_verified_at', async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const updateFn = jest.fn().mockReturnValue({ eq: updateEq });
    supabase.from.mockReturnValueOnce({ update: updateFn });

    const res = await webhookPOST(signedReq({
      session_id: 'sess_1',
      status: 'Approved',
      webhook_type: 'status.updated',
      created_at: 1,
      timestamp: 1,
      workflow_id: 'wf',
    }));

    expect(res.status).toBe(200);
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ kyc_status: 'VERIFIED', kyc_verified_at: expect.any(String) }));
    expect(updateEq).toHaveBeenCalledWith('didit_session_id', 'sess_1');
  });

  it('updates user to REJECTED on Declined', async () => {
    const updateFn = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    supabase.from.mockReturnValueOnce({ update: updateFn });

    const res = await webhookPOST(signedReq({
      session_id: 'sess_2',
      status: 'Declined',
      webhook_type: 'status.updated',
      created_at: 1,
      timestamp: 1,
      workflow_id: 'wf',
    }));

    expect(res.status).toBe(200);
    const arg = updateFn.mock.calls[0][0];
    expect(arg.kyc_status).toBe('REJECTED');
    expect(arg.kyc_verified_at).toBeUndefined();
  });
});

describe('GET /api/kyc/status', () => {
  it('returns 401 without a token', async () => {
    const res = await statusGET(new NextRequest('http://localhost/api/kyc/status'));
    expect(res.status).toBe(401);
  });

  it('returns the user kyc state', async () => {
    mockSelectSingle({
      data: { kyc_status: 'VERIFIED', kyc_verified_at: '2026-05-09T12:00:00Z', didit_session_url: 'https://verify.example/x' },
      error: null,
    });
    const res = await statusGET(
      new NextRequest('http://localhost/api/kyc/status', {
        headers: { Authorization: `Bearer ${validToken}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('VERIFIED');
    expect(body.session_url).toBe('https://verify.example/x');
  });
});
