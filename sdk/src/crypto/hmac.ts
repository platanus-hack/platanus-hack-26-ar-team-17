import crypto from 'crypto';

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function buildPayload(
  agentId: string,
  timestamp: string,
  nonce: string,
  action: string,
  platform: string,
): string {
  return `${agentId}|${timestamp}|${nonce}|${action}|${platform}`;
}

export function signPayload(apiSecret: string, payload: string): string {
  return crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
}
