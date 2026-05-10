import { post } from '../http/client';
import { generateNonce, buildPayload, signPayload } from '../crypto/hmac';
import { getCachedToken, setCachedToken } from '../auth/cache';

interface ValidateParams {
  agentId:        string;
  apiSecret:      string;
  action:         string;
  platform:       string;
  platformApiUrl: string;
}

interface ValidateResponse {
  allowed: boolean;
  token?: string;
  expiresAt?: string;
}

export async function validate(params: ValidateParams): Promise<{ allowed: boolean; token?: string }> {
  const { agentId, apiSecret, action, platform, platformApiUrl } = params;

  const cached = getCachedToken();
  if (cached) return { allowed: true, token: cached };

  const nonce = generateNonce();
  const timestamp = new Date().toISOString();
  const payload = buildPayload(agentId, timestamp, nonce, action, platform);
  const signature = signPayload(apiSecret, payload);

  const res = await post<ValidateResponse>(`${platformApiUrl}/api/validate`, {
    agentId,
    timestamp,
    nonce,
    action,
    platform,
    signature,
  });

  if (res.allowed && res.token && res.expiresAt) {
    setCachedToken(res.token, res.expiresAt);
  }

  return { allowed: res.allowed, token: res.token };
}
