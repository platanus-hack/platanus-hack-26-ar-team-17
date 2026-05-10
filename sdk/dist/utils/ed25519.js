"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChallengePayload = buildChallengePayload;
exports.deriveMLDSAPublicKey = deriveMLDSAPublicKey;
exports.signChallengeMLDSA = signChallengeMLDSA;
exports.signChallenge = signChallenge;
const crypto_1 = require("crypto");
const ml_dsa_js_1 = require("@noble/post-quantum/ml-dsa.js");
/**
 * Builds the deterministic challenge payload - must match the backend implementation exactly.
 */
function buildChallengePayload(challengeId, nonce, agentId) {
    return `${challengeId}|${nonce}|${agentId}`;
}
/**
 * Signs a challenge payload using an Ed25519 private key (raw 32-byte hex-encoded seed).
 * Node.js crypto requires the key wrapped in a PKCS#8 DER envelope.
 * Ed25519 PKCS#8 DER prefix: 302e020100300506032b657004220420
 * Uses crypto.sign(null, ...) — Ed25519 does its own internal hashing; no digest needed.
 */
function deriveMLDSAPublicKey(seedHex) {
    const { publicKey } = ml_dsa_js_1.ml_dsa65.keygen(Buffer.from(seedHex, 'hex'));
    return Buffer.from(publicKey).toString('hex');
}
function signChallengeMLDSA(seedHex, message) {
    const { secretKey } = ml_dsa_js_1.ml_dsa65.keygen(Buffer.from(seedHex, 'hex'));
    // @noble/post-quantum sign(msg, secretKey) — message first, key second
    const sig = ml_dsa_js_1.ml_dsa65.sign(Buffer.from(message, 'utf8'), secretKey);
    return Buffer.from(sig).toString('hex');
}
function signChallenge(privateKeyHex, message) {
    const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    const rawKey = Buffer.from(privateKeyHex, 'hex');
    const pkcs8Der = Buffer.concat([prefix, rawKey]);
    return (0, crypto_1.sign)(null, Buffer.from(message, 'utf8'), { key: pkcs8Der, format: 'der', type: 'pkcs8' }).toString('hex');
}
