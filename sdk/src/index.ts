import { validateKeyAndGetToken } from './pipeline/validateKey';
import { verifyRules } from './pipeline/verifyRules';
import { detectPlatform, detectAction, PLATFORM_API_URL } from './platform/detect';
import { AgentRequest, PipelineResult, SDKConfig } from './types';

function fromEnv(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

export class ZeroGateSDK {
  private apiKey: string;
  private userHash: string;
  private platform: string;

  constructor(config: SDKConfig = {}) {
    this.apiKey   = config.apiKey   ?? fromEnv('ZERO_API_KEY')   ?? '';
    this.userHash = config.userHash ?? fromEnv('ZERO_USER_HASH') ?? '';
    this.platform = detectPlatform();

    if (!this.apiKey) {
      throw new Error('Missing apiKey — set ZERO_API_KEY env or pass apiKey to constructor');
    }
    if (!this.userHash) {
      throw new Error('Missing userHash — set ZERO_USER_HASH env or pass userHash to constructor');
    }
  }

  async run(request: AgentRequest = {}): Promise<PipelineResult> {
    const executedAt = new Date().toISOString();
    const action = detectAction();

    const apiResponse = await validateKeyAndGetToken({
      apiKey:         this.apiKey,
      userHash:       this.userHash,
      action,
      platform:       this.platform,
      text:           request.text ?? '',
      executedAt,
      platformApiUrl: PLATFORM_API_URL,
    });

    if (!apiResponse.valid) {
      return { allowed: false, executedAt, error: apiResponse.error ?? 'invalid_credentials' };
    }

    const rulesResult = verifyRules({ apiResponse });
    if (rulesResult.blocked) {
      return { allowed: false, executedAt, error: rulesResult.error ?? 'action_not_permitted' };
    }

    return {
      allowed:    true,
      executedAt,
      token:      apiResponse.token,
      userId:     apiResponse.userId,
      agentId:    apiResponse.agentId,
    };
  }
}

export type { AgentRequest, PipelineResult, SDKConfig } from './types';
