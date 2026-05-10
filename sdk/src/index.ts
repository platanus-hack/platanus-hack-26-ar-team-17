import { validate } from './pipeline/validateKey';
import { detectPlatform, detectAction, PLATFORM_API_URL } from './platform/detect';

export interface SDKConfig {
  agentId?:   string;
  apiSecret?: string;
}

export interface RunResult {
  allowed: boolean;
  token?: string;
}

function fromEnv(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

export class ZeroGateSDK {
  private agentId:   string;
  private apiSecret: string;
  private platform:  string;

  constructor(config: SDKConfig = {}) {
    this.agentId   = config.agentId   ?? fromEnv('ZERO_AGENT_ID')   ?? '';
    this.apiSecret = config.apiSecret ?? fromEnv('ZERO_API_SECRET') ?? '';
    this.platform  = detectPlatform();

    if (!this.agentId)   throw new Error('Missing agentId — set ZERO_AGENT_ID env');
    if (!this.apiSecret) throw new Error('Missing apiSecret — set ZERO_API_SECRET env');
  }

  async run(): Promise<RunResult> {
    return validate({
      agentId:        this.agentId,
      apiSecret:      this.apiSecret,
      action:         detectAction(),
      platform:       this.platform,
      platformApiUrl: PLATFORM_API_URL,
    });
  }
}
