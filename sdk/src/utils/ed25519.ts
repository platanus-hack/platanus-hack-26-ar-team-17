import { sign } from 'crypto';

/**
 * Builds the deterministic challenge payload - must match the backend implementation exactly.
 */
export function buildChallengePayload(challengeId: string, nonce: string, agentId: string): string {
  return `${challengeId}|${nonce}|${agentId}`;
}

/**
 * Signs a challenge payload using an Ed25519 private key (raw 32-byte hex-encoded seed).
 * Node.js crypto requires the key wrapped in a PKCS#8 DER envelope.
 * Ed25519 PKCS#8 DER prefix: 302e020100300506032b657004220420
 * Uses crypto.sign(null, ...) — Ed25519 does its own internal hashing; no digest needed.
 */
export function signChallenge(privateKeyHex: string, message: string): string {
  const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
  const rawKey = Buffer.from(privateKeyHex, 'hex');
  const pkcs8Der = Buffer.concat([prefix, rawKey]);
  return sign(null, Buffer.from(message, 'utf8'), { key: pkcs8Der, format: 'der', type: 'pkcs8' }).toString('hex');
}
