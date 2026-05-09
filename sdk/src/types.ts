export interface SDKConfig {
  /** API key for the agent (from Zero dashboard) */
  apiKey: string;
  /** User hash (from Zero dashboard) — ties the key to your account */
  userHash: string;
  /** Zero Platform API base URL */
  platformApiUrl: string;
  /**
   * Platform identifier. If omitted, auto-detected from environment:
   *   1. ZERO_PLATFORM env var
   *   2. MCP SDK in process → 'mcp'
   *   3. Falls back to 'custom'
   */
  platform?: string;
}

export interface AgentRequest {
  action: string;
  text?: string;
  /** Override platform for this specific request */
  platform?: string;
}

export interface ValidationResponse {
  valid: boolean;
  token?: string;
  userId?: string;
  agentId?: string;
  error?: string;
}

export interface PipelineResult {
  allowed: boolean;
  token?: string;
  userId?: string;
  agentId?: string;
  executedAt: string;
  error?: string;
}
