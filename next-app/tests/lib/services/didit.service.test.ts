import crypto from 'crypto';
import {
  createVerificationSession,
  verifyWebhookSignatureV2,
  mapDiditStatusToKyc,
} from '@/lib/services/didit.service';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.DIDIT_API_KEY = 'test-api-key';
  process.env.DIDIT_WORKFLOW_ID = 'wf_test';
  process.env.DIDIT_WEBHOOK_SECRET = 'shhh';
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('createVerificationSession', () => {
  it('POSTs to Didit with the right headers and body, returns the session', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ session_id: 'sess_1', url: 'https://verify.example/sess_1', status: 'Not Started' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await createVerificationSession({ userId: 'user_1', callbackUrl: 'https://app.test/' });

    expect(result.session_id).toBe('sess_1');
    expect(result.url).toBe('https://verify.example/sess_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://verification.didit.me/v3/session/');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-api-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      workflow_id: 'wf_test',
      vendor_data: 'user_1',
      callback: 'https://app.test/',
    });
  });

  it('throws on non-2xx response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('insufficient credits', { status: 400 })
    );
    await expect(
      createVerificationSession({ userId: 'u', callbackUrl: 'https://app/' })
    ).rejects.toThrow(/Didit createSession failed: 400/);
  });

  it('throws when DIDIT_API_KEY is missing', async () => {
    delete process.env.DIDIT_API_KEY;
    await expect(
      createVerificationSession({ userId: 'u', callbackUrl: 'https://app/' })
    ).rejects.toThrow(/DIDIT_API_KEY/);
  });
});

describe('verifyWebhookSignatureV2', () => {
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

  function sign(payload: object, secret = 'shhh'): { rawBody: string; signature: string; timestamp: string } {
    const rawBody = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(canonicalJSON(payload)).digest('hex');
    return { rawBody, signature, timestamp: String(Math.floor(Date.now() / 1000)) };
  }

  it('accepts a valid signature within the time window', () => {
    const { rawBody, signature, timestamp } = sign({ session_id: 'a', status: 'Approved', extra: { z: 1, a: 2 } });
    expect(
      verifyWebhookSignatureV2({
        rawBody,
        signatureHeader: signature,
        timestampHeader: timestamp,
      })
    ).toBe(true);
  });

  it('rejects when the timestamp is outside the 300s window', () => {
    const { rawBody, signature } = sign({ session_id: 'a', status: 'Approved' });
    const stale = String(Math.floor(Date.now() / 1000) - 600);
    expect(
      verifyWebhookSignatureV2({
        rawBody,
        signatureHeader: signature,
        timestampHeader: stale,
      })
    ).toBe(false);
  });

  it('rejects when the signature is wrong', () => {
    const { rawBody, timestamp } = sign({ session_id: 'a', status: 'Approved' });
    expect(
      verifyWebhookSignatureV2({
        rawBody,
        signatureHeader: 'a'.repeat(64),
        timestampHeader: timestamp,
      })
    ).toBe(false);
  });

  it('rejects when the body is not valid JSON', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(
      verifyWebhookSignatureV2({
        rawBody: 'not-json',
        signatureHeader: 'a'.repeat(64),
        timestampHeader: ts,
      })
    ).toBe(false);
  });

  it('rejects when headers are missing', () => {
    expect(
      verifyWebhookSignatureV2({ rawBody: '{}', signatureHeader: null, timestampHeader: null })
    ).toBe(false);
  });

  it('signature is independent of key order in the source body', () => {
    const ordered = { a: 1, z: 2 };
    const reordered = { z: 2, a: 1 };
    const { signature, timestamp } = sign(ordered);
    expect(
      verifyWebhookSignatureV2({
        rawBody: JSON.stringify(reordered),
        signatureHeader: signature,
        timestampHeader: timestamp,
      })
    ).toBe(true);
  });
});

describe('mapDiditStatusToKyc', () => {
  it('maps statuses correctly', () => {
    expect(mapDiditStatusToKyc('Approved')).toBe('VERIFIED');
    expect(mapDiditStatusToKyc('Declined')).toBe('REJECTED');
    expect(mapDiditStatusToKyc('Abandoned')).toBe('REJECTED');
    expect(mapDiditStatusToKyc('In Review')).toBe('IN_REVIEW');
    expect(mapDiditStatusToKyc('In Progress')).toBe('PENDING');
    expect(mapDiditStatusToKyc('Not Started')).toBe('PENDING');
  });
});
