import { validateKeyAndGetToken } from './pipeline/validateKey';
import { verifyRules } from './pipeline/verifyRules';
import { detectPlatform } from './platform/detect';
import { AgentRequest, PipelineResult, SDKConfig } from './types';

export class ZeroGateSDK {
  private apiKey: string;
  private userHash: string;
  private platformApiUrl: string;
  private platform: string;

  constructor(config: SDKConfig) {
    if (!config.platformApiUrl.startsWith('https://')) {
      throw new Error('platformApiUrl must use HTTPS');
    }
    if (!config.apiKey) throw new Error('apiKey is required');
    if (!config.userHash) throw new Error('userHash is required');

    this.apiKey = config.apiKey;
    this.userHash = config.userHash;
    this.platformApiUrl = config.platformApiUrl;
    this.platform = detectPlatform(config.platform);
  }

  async run(request: AgentRequest): Promise<PipelineResult> {
    const executedAt = new Date().toISOString();

    const apiResponse = await validateKeyAndGetToken({
      apiKey:         this.apiKey,
      userHash:       this.userHash,
      action:         request.action,
      platform:       request.platform ?? this.platform,
      text:           request.text ?? '',
      executedAt,
      platformApiUrl: this.platformApiUrl,
    });

    if (!apiResponse.valid) {
      return { allowed: false, executedAt, error: apiResponse.error ?? 'invalid_credentials' };
    }

    const rulesResult = verifyRules({ apiResponse });
    if (rulesResult.blocked) {
      return { allowed: false, executedAt, error: rulesResult.error ?? 'action_not_permitted' };
    }

    return {
      allowed:   true,
      executedAt,
      token:     apiResponse.token,
      userId:    apiResponse.userId,
      agentId:   apiResponse.agentId,
    };
  }
}

export type { AgentRequest, PipelineResult, SDKConfig } from './types';
