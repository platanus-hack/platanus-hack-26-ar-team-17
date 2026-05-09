import crypto from 'crypto';
import { post } from '../http/client';
import { normalizeAction } from '../normalize/action';
import { normalizeText } from '../normalize/text';
import { ValidationResponse } from '../types';

interface ValidateParams {
  apiKey: string;
  userHash: string;
  action: string;
  platform: string;
  text: string;
  executedAt: string;
  platformApiUrl: string;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function validateKeyAndGetToken(params: ValidateParams): Promise<ValidationResponse> {
  return post<ValidationResponse>(
    `${params.platformApiUrl}/api/validate`,
    {
      api_key:     hashKey(params.apiKey),
      user_hash:   params.userHash,
      action:      normalizeAction(params.action),
      platform:    params.platform,
      text:        normalizeText(params.text),
      executed_at: params.executedAt,
    }
  );
}
