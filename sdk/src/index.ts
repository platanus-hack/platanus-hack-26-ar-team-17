import { validate } from './pipeline/validateKey';
import { detectPlatform, detectAction, PLATFORM_API_URL } from './platform/detect';

export interface SDKConfig {
  apiKey?:   string;
  userHash?: string;
}

export interface RunResult {
  allowed: boolean;
}

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

    if (!this.apiKey)   throw new Error('Missing apiKey — set ZERO_API_KEY env');
    if (!this.userHash) throw new Error('Missing userHash — set ZERO_USER_HASH env');
  }

  async run(): Promise<RunResult> {
    return validate({
      token:    this.apiKey,
      hash:     this.userHash,
      action:   detectAction(),
      platform: this.platform,
      platformApiUrl: PLATFORM_API_URL,
    });
  }
}
