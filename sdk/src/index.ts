import { validateKeyAndGetToken } from './pipeline/validateKey';
import { verifyRules } from './pipeline/verifyRules';
import { detectPlatform } from './platform/detect';
import { AgentRequest, PipelineResult, SDKConfig } from './types';

const DEFAULT_PLATFORM_URL = 'https://next-app-ochre-zeta.vercel.app';

function fromEnv(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

export class ZeroGateSDK {
  private apiKey: string;
  private userHash: string;
  private platformApiUrl: string;
  private platform: string;

  constructor(config: SDKConfig = {}) {
    this.apiKey   = config.apiKey   ?? fromEnv('ZERO_API_KEY')   ?? '';
    this.userHash = config.userHash ?? fromEnv('ZERO_USER_HASH') ?? '';
    this.platformApiUrl = config.platformApiUrl
      ?? fromEnv('ZERO_PLATFORM_URL')
      ?? DEFAULT_PLATFORM_URL;
    this.platform = detectPlatform(config.platform);

    if (!this.apiKey) {
      throw new Error('Missing apiKey — set ZERO_API_KEY env or pass apiKey to constructor');
    }
    if (!this.userHash) {
      throw new Error('Missing userHash — set ZERO_USER_HASH env or pass userHash to constructor');
    }
    if (!this.platformApiUrl.startsWith('https://')) {
      throw new Error('platformApiUrl must use HTTPS');
    }
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
      allowed:    true,
      executedAt,
      token:      apiResponse.token,
      userId:     apiResponse.userId,
      agentId:    apiResponse.agentId,
    };
  }
}

export type { AgentRequest, PipelineResult, SDKConfig } from './types';
