import { verify } from 'crypto';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

/**
 * Builds the deterministic payload that the agent must sign.
 * Both backend (verify) and SDK (sign) must produce this exact string.
 */
export function buildChallengePayload(challengeId: string, nonce: string, agentId: string): string {
  return `${challengeId}|${nonce}|${agentId}`;
}

/**
 * Verifies an Ed25519 signature against a raw 32-byte public key (hex-encoded).
 * Node.js crypto requires the public key wrapped in a SubjectPublicKeyInfo DER envelope.
 * Ed25519 SPKI DER prefix: OID 1.3.101.112 → 302a300506032b6570032100
 */
export function verifyMLDSASignature(
  publicKeyHex: string,
  message: string,
  signatureHex: string,
): boolean {
  try {
    const pub = Buffer.from(publicKeyHex, 'hex');
    if (pub.length !== 1952) return false;
    const sig = Buffer.from(signatureHex, 'hex');
    if (sig.length !== 3309) return false;
    // @noble/post-quantum verify(sig, msg, publicKey) — signature first
    return ml_dsa65.verify(sig, Buffer.from(message, 'utf8'), pub);
  } catch {
    return false;
  }
}

export function verifyEd25519Signature(
  publicKeyHex: string,
  message: string,
  signatureHex: string,
): boolean {
  try {
    const prefix = Buffer.from('302a300506032b6570032100', 'hex');
    const rawKey = Buffer.from(publicKeyHex, 'hex');
    if (rawKey.length !== 32) return false;
    const spkiDer = Buffer.concat([prefix, rawKey]);
    // Ed25519 uses no separate digest step; pass null as the algorithm.
    return verify(null, Buffer.from(message, 'utf8'), { key: spkiDer, format: 'der', type: 'spki' }, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}
