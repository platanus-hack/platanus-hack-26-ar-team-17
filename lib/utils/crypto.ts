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
