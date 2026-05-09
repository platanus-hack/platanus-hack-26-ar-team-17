import { verify } from 'crypto';

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
