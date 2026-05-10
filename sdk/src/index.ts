import { validate } from './pipeline/validateKey';
import { detectPlatform, detectAction, PLATFORM_API_URL } from './platform/detect';
import { getCachedToken } from './auth/cache';
import { performChallengeFlow } from './auth/challengeFlow';

export interface SDKConfig {
  agentId?:        string;
  apiSecret?:      string;
  privateKey?:     string;
  privateKeyPqc?:  string;
  /** Override the Platform API URL (useful for tests and local dev). */
  platformApiUrl?: string;
}

export interface RunResult {
  allowed: boolean;
  token?: string;
  receipt?: string;
}

function fromEnv(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

export class ZeroGateSDK {
  private agentId:       string;
  private apiSecret:     string;
  private privateKey:    string;
  private privateKeyPqc: string;
  private platform:      string;
  private platformApiUrl: string;
  private readonly mode: 'hmac' | 'ed25519';

  constructor(config: SDKConfig = {}) {
    this.agentId       = config.agentId       ?? fromEnv('ZERO_AGENT_ID')        ?? '';
    this.apiSecret     = config.apiSecret     ?? fromEnv('ZERO_API_SECRET')      ?? '';
    this.privateKey    = config.privateKey    ?? fromEnv('ZERO_PRIVATE_KEY')     ?? '';
    this.privateKeyPqc = config.privateKeyPqc ?? fromEnv('ZERO_PRIVATE_KEY_PQC') ?? '';
    this.platformApiUrl = config.platformApiUrl ?? PLATFORM_API_URL;
    this.platform      = detectPlatform();

    if (this.agentId && this.privateKey) {
      this.mode = 'ed25519';
    } else if (this.agentId && this.apiSecret) {
      this.mode = 'hmac';
    } else {
      throw new Error(
        'Missing credentials — provide (agentId + privateKey) for Ed25519 mode, ' +
        'or (agentId + apiSecret) for HMAC mode',
      );
    }
  }

  async run(): Promise<RunResult> {
    if (this.mode === 'ed25519') {
      const cached = getCachedToken();
      if (cached) return { allowed: true, token: cached };
      const { token, receipt } = await performChallengeFlow(
        this.agentId,
        this.privateKey,
        detectAction(),
        this.platform,
        this.platformApiUrl,
        this.privateKeyPqc || undefined,
      );
      return { allowed: true, token, receipt };
    }

    // HMAC mode
    const result = await validate({
      agentId:        this.agentId,
      apiSecret:      this.apiSecret,
      action:         detectAction(),
      platform:       this.platform,
      platformApiUrl: this.platformApiUrl,
    });
    return result;
  }
}
