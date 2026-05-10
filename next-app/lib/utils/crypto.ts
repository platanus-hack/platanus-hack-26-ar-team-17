import crypto from 'crypto';

export function generateApiKey(): string {
  return `ak_${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 11); // "ak_" + 8 chars
}

// --- HMAC agent secret ---

export function generateAgentSecret(): string {
  return crypto.randomBytes(48).toString('base64url');
}

// AES-256-GCM encryption — format: iv_hex:authTag_hex:ciphertext_hex
export function encryptSecret(secret: string, encryptionKey: string): string {
  const key = Buffer.from(encryptionKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(enc: string, encryptionKey: string): string {
  const [ivHex, authTagHex, ciphertextHex] = enc.split(':');
  const key = Buffer.from(encryptionKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

// Deterministic payload string signed by the SDK
export function buildHmacPayload(
  agentId: string,
  timestamp: string,
  nonce: string,
  action: string,
  platform: string,
): string {
  return `${agentId}|${timestamp}|${nonce}|${action}|${platform}`;
}

// Constant-time HMAC-SHA256 comparison
export function verifyHmacSignature(secret: string, payload: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
