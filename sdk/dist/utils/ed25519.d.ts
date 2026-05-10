/**
 * Builds the deterministic challenge payload - must match the backend implementation exactly.
 */
export declare function buildChallengePayload(challengeId: string, nonce: string, agentId: string): string;
/**
 * Signs a challenge payload using an Ed25519 private key (raw 32-byte hex-encoded seed).
 * Node.js crypto requires the key wrapped in a PKCS#8 DER envelope.
 * Ed25519 PKCS#8 DER prefix: 302e020100300506032b657004220420
 * Uses crypto.sign(null, ...) — Ed25519 does its own internal hashing; no digest needed.
 */
export declare function signChallenge(privateKeyHex: string, message: string): string;
//# sourceMappingURL=ed25519.d.ts.map