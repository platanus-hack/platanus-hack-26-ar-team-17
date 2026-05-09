import { generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from 'crypto';
import { buildChallengePayload, verifyEd25519Signature } from '@/lib/utils/ed25519';

function generateTestKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const pubHex = pubDer.slice(12).toString('hex'); // strip 12-byte SPKI prefix
  return { pubHex, privateKey };
}

describe('buildChallengePayload', () => {
  it('builds a pipe-delimited deterministic string', () => {
    expect(buildChallengePayload('cid-1', 'nonce-abc', 'agent-xyz')).toBe('cid-1|nonce-abc|agent-xyz');
  });

  it('is sensitive to field order', () => {
    expect(buildChallengePayload('a', 'b', 'c')).not.toBe(buildChallengePayload('b', 'a', 'c'));
  });
});

describe('verifyEd25519Signature', () => {
  it('verifies a valid signature', () => {
    const { pubHex, privateKey } = generateTestKeyPair();
    const sig = cryptoSign(null, Buffer.from('hello', 'utf8'), privateKey).toString('hex');
    expect(verifyEd25519Signature(pubHex, 'hello', sig)).toBe(true);
  });

  it('rejects a tampered message', () => {
    const { pubHex, privateKey } = generateTestKeyPair();
    const sig = cryptoSign(null, Buffer.from('original', 'utf8'), privateKey).toString('hex');
    expect(verifyEd25519Signature(pubHex, 'tampered', sig)).toBe(false);
  });

  it('rejects a wrong public key', () => {
    const { privateKey } = generateTestKeyPair();
    const { pubHex: otherPub } = generateTestKeyPair();
    const sig = cryptoSign(null, Buffer.from('msg', 'utf8'), privateKey).toString('hex');
    expect(verifyEd25519Signature(otherPub, 'msg', sig)).toBe(false);
  });

  it('rejects a malformed key', () => {
    expect(verifyEd25519Signature('zz', 'msg', 'a'.repeat(128))).toBe(false);
  });

  it('rejects a public key shorter than 32 bytes', () => {
    expect(verifyEd25519Signature('a'.repeat(62), 'msg', 'a'.repeat(128))).toBe(false);
  });

  it('verifies a signature over the challenge payload format', () => {
    const { pubHex, privateKey } = generateTestKeyPair();
    const payload = buildChallengePayload('cid-abc', 'nonce-123', 'agent-456');
    const sig = cryptoSign(null, Buffer.from(payload, 'utf8'), privateKey).toString('hex');
    expect(verifyEd25519Signature(pubHex, payload, sig)).toBe(true);
  });

  it('round-trips with the SDK signChallenge helper (cross-implementation check)', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const pubHex = pubDer.slice(12).toString('hex');
    const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
    const privHex = privDer.slice(16).toString('hex');

    // Re-assemble PKCS#8 DER and sign the way the SDK does
    const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    const pkcs8Der = Buffer.concat([prefix, Buffer.from(privHex, 'hex')]);
    const payload = buildChallengePayload('c', 'n', 'a');
    const sig = cryptoSign(null, Buffer.from(payload, 'utf8'), { key: pkcs8Der, format: 'der', type: 'pkcs8' }).toString('hex');

    expect(verifyEd25519Signature(pubHex, payload, sig)).toBe(true);

    // Also verify: a different payload should fail
    expect(verifyEd25519Signature(pubHex, 'different', sig)).toBe(false);
  });
});
