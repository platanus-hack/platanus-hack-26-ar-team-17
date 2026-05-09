import { validateKeyAndGetToken } from './pipeline/validateKey';
import { verifyScope } from './pipeline/verifyScope';
import { verifyRules } from './pipeline/verifyRules';
import { AgentRequest, PipelineResult, SDKConfig } from './types';

export class AgentAuthSDK {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    if (!config.platformApiUrl.startsWith('https://')) {
      throw new Error('platformApiUrl must use HTTPS');
    }
    this.config = config;
  }

  async run(request: AgentRequest): Promise<PipelineResult> {
    const apiResponse = await validateKeyAndGetToken({
      apiKey: request.apiKey,
      action: request.action,
      platform: request.platform,
      text: request.text ?? '',
      platformApiUrl: this.config.platformApiUrl,
    });

    if (!apiResponse.valid) {
      return { allowed: false, error: apiResponse.error ?? 'invalid_api_key' };
    }

    if (!verifyScope(request.action, apiResponse.scope ?? [])) {
      return { allowed: false, error: 'action_not_permitted' };
    }

    const rulesResult = verifyRules({ apiResponse });
    if (rulesResult.blocked) {
      return { allowed: false, error: rulesResult.error ?? 'action_not_permitted' };
    }

    return {
      allowed: true,
      token: apiResponse.token,
      userId: apiResponse.userId,
    };
  }
}

export type { AgentRequest, PipelineResult, SDKConfig } from './types';
