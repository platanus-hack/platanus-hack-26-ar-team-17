import { post } from '../http/client';

interface ValidateParams {
  token:    string;
  hash:     string;
  action:   string;
  platform: string;
  platformApiUrl: string;
}

export async function validate(params: ValidateParams): Promise<{ allowed: boolean }> {
  return post<{ allowed: boolean }>(
    `${params.platformApiUrl}/api/validate`,
    {
      token:    params.token,
      hash:     params.hash,
      action:   params.action,
      platform: params.platform,
    }
  );
}
