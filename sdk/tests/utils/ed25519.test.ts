import { generateKeyPairSync, verify as cryptoVerify } from 'crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { buildChallengePayload, signChallenge, signChallengeMLDSA, deriveMLDSAPublicKey } from '../../src/utils/ed25519';

function generateTestKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const pubHex = pubDer.slice(12).toString('hex');
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
  const privHex = privDer.slice(16).toString('hex');
  return { pubHex, privHex, publicKey };
}

describe('buildChallengePayload', () => {
  it('returns a pipe-delimited string', () => {
    expect(buildChallengePayload('c', 'n', 'a')).toBe('c|n|a');
  });
});

describe('signChallenge', () => {
  it('produces a 128-char hex signature', () => {
    const { privHex } = generateTestKeyPair();
    const sig = signChallenge(privHex, 'hello');
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
  });

  it('produces a signature verifiable with the matching public key', () => {
    const { pubHex, privHex } = generateTestKeyPair();
    const message = buildChallengePayload('cid', 'nonce', 'agentId');
    const sig = signChallenge(privHex, message);

    // Verify using the backend's SPKI DER prefix approach
    const prefix = Buffer.from('302a300506032b6570032100', 'hex');
    const spkiDer = Buffer.concat([prefix, Buffer.from(pubHex, 'hex')]);
    const ok = cryptoVerify(null, Buffer.from(message, 'utf8'), { key: spkiDer, format: 'der', type: 'spki' }, Buffer.from(sig, 'hex'));
    expect(ok).toBe(true);
  });

  it('produces a different signature for a different message', () => {
    const { privHex } = generateTestKeyPair();
    const sig1 = signChallenge(privHex, 'msg1');
    const sig2 = signChallenge(privHex, 'msg2');
    expect(sig1).not.toBe(sig2);
  });
});

const PQC_SEED = 'a'.repeat(64); // 32-byte seed, hex-encoded

describe('deriveMLDSAPublicKey', () => {
  it('produces a 3904-char hex string (1952-byte public key)', () => {
    const pub = deriveMLDSAPublicKey(PQC_SEED);
    expect(pub).toMatch(/^[0-9a-f]{3904}$/);
  });

  it('is deterministic for the same seed', () => {
    expect(deriveMLDSAPublicKey(PQC_SEED)).toBe(deriveMLDSAPublicKey(PQC_SEED));
  });

  it('produces different keys for different seeds', () => {
    expect(deriveMLDSAPublicKey(PQC_SEED)).not.toBe(deriveMLDSAPublicKey('b'.repeat(64)));
  });
});

describe('signChallengeMLDSA', () => {
  it('produces a 6618-char hex signature (3309-byte ML-DSA-65)', () => {
    const sig = signChallengeMLDSA(PQC_SEED, 'hello');
    expect(sig).toMatch(/^[0-9a-f]{6618}$/);
  });

  it('round-trips: signature is verifiable by @noble/post-quantum directly', () => {
    const message = buildChallengePayload('cid', 'nonce', 'agent');
    const sig = signChallengeMLDSA(PQC_SEED, message);
    const pub = Buffer.from(deriveMLDSAPublicKey(PQC_SEED), 'hex');
    const ok = ml_dsa65.verify(Buffer.from(sig, 'hex'), Buffer.from(message, 'utf8'), pub);
    expect(ok).toBe(true);
  });

  it('rejects verification with a tampered message', () => {
    const sig = signChallengeMLDSA(PQC_SEED, 'original');
    const pub = Buffer.from(deriveMLDSAPublicKey(PQC_SEED), 'hex');
    const ok = ml_dsa65.verify(Buffer.from(sig, 'hex'), Buffer.from('tampered', 'utf8'), pub);
    expect(ok).toBe(false);
  });
});
