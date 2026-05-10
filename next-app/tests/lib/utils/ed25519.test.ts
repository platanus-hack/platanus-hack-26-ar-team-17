import { generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify } from 'crypto';
import { buildChallengePayload, verifyEd25519Signature, verifyMLDSASignature } from '@/lib/utils/ed25519';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

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

const PQC_SEED = 'a'.repeat(64); // 32-byte seed, hex-encoded

describe('verifyMLDSASignature', () => {
  it('verifies a valid ML-DSA-65 signature', () => {
    const message = 'hello pqc';
    const { secretKey, publicKey } = ml_dsa65.keygen(Buffer.from(PQC_SEED, 'hex'));
    const sig = ml_dsa65.sign(Buffer.from(message, 'utf8'), secretKey);
    const pubHex = Buffer.from(publicKey).toString('hex');
    const sigHex = Buffer.from(sig).toString('hex');
    expect(verifyMLDSASignature(pubHex, message, sigHex)).toBe(true);
  });

  it('rejects a tampered message', () => {
    const { secretKey, publicKey } = ml_dsa65.keygen(Buffer.from(PQC_SEED, 'hex'));
    const sig = ml_dsa65.sign(Buffer.from('original', 'utf8'), secretKey);
    const pubHex = Buffer.from(publicKey).toString('hex');
    const sigHex = Buffer.from(sig).toString('hex');
    expect(verifyMLDSASignature(pubHex, 'tampered', sigHex)).toBe(false);
  });

  it('rejects a wrong public key', () => {
    const { secretKey } = ml_dsa65.keygen(Buffer.from(PQC_SEED, 'hex'));
    const { publicKey: otherPub } = ml_dsa65.keygen(Buffer.from('b'.repeat(64), 'hex'));
    const sig = ml_dsa65.sign(Buffer.from('msg', 'utf8'), secretKey);
    const sigHex = Buffer.from(sig).toString('hex');
    const otherPubHex = Buffer.from(otherPub).toString('hex');
    expect(verifyMLDSASignature(otherPubHex, 'msg', sigHex)).toBe(false);
  });

  it('rejects a public key of wrong length', () => {
    const sig = 'a'.repeat(6618);
    expect(verifyMLDSASignature('a'.repeat(3902), 'msg', sig)).toBe(false);
  });

  it('rejects a signature of wrong length', () => {
    const { publicKey } = ml_dsa65.keygen(Buffer.from(PQC_SEED, 'hex'));
    const pubHex = Buffer.from(publicKey).toString('hex');
    expect(verifyMLDSASignature(pubHex, 'msg', 'a'.repeat(6616))).toBe(false);
  });

  it('cross-implementation round-trip: SDK signChallengeMLDSA -> verifyMLDSASignature', () => {
    // Simulate what the SDK does: sign with ml_dsa65.sign(msg, secretKey)
    const { secretKey, publicKey } = ml_dsa65.keygen(Buffer.from(PQC_SEED, 'hex'));
    const payload = buildChallengePayload('cid', 'nonce', 'agent');
    const sig = ml_dsa65.sign(Buffer.from(payload, 'utf8'), secretKey);
    const pubHex = Buffer.from(publicKey).toString('hex');
    const sigHex = Buffer.from(sig).toString('hex');
    expect(verifyMLDSASignature(pubHex, payload, sigHex)).toBe(true);
    expect(verifyMLDSASignature(pubHex, 'different', sigHex)).toBe(false);
  });
});
