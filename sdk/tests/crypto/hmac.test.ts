import crypto from 'crypto';
import { generateNonce, buildPayload, signPayload } from '../../src/crypto/hmac';

describe('generateNonce', () => {
  it('returns a 64-character hex string (32 bytes)', () => {
    const nonce = generateNonce();
    expect(nonce).toHaveLength(64);
    expect(nonce).toMatch(/^[0-9a-f]+$/);
  });

  it('generates unique nonces on each call', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe('buildPayload', () => {
  it('joins fields with pipe separator', () => {
    const payload = buildPayload('agent-1', '2024-01-01T00:00:00.000Z', 'nonce123', 'send_message', 'mcp');
    expect(payload).toBe('agent-1|2024-01-01T00:00:00.000Z|nonce123|send_message|mcp');
  });

  it('is deterministic for the same inputs', () => {
    const p1 = buildPayload('a', 'b', 'c', 'd', 'e');
    const p2 = buildPayload('a', 'b', 'c', 'd', 'e');
    expect(p1).toBe(p2);
  });
});

describe('signPayload', () => {
  const secret = 'test-secret-key';
  const payload = 'agentId|timestamp|nonce|action|platform';

  it('returns a 64-character hex string (SHA-256 HMAC)', () => {
    const sig = signPayload(secret, payload);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic for the same secret and payload', () => {
    expect(signPayload(secret, payload)).toBe(signPayload(secret, payload));
  });

  it('differs for different secrets', () => {
    expect(signPayload('secret-a', payload)).not.toBe(signPayload('secret-b', payload));
  });

  it('differs for different payloads', () => {
    expect(signPayload(secret, 'payload-a')).not.toBe(signPayload(secret, 'payload-b'));
  });

  it('matches manual HMAC-SHA256 computation', () => {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(signPayload(secret, payload)).toBe(expected);
  });
});
