export interface SDKConfig {
  /**
   * API key for the agent. Defaults to env var ZERO_API_KEY.
   * In MCP context: set via the MCP server's env config in Claude Desktop.
   */
  apiKey?: string;
  /**
   * User hash. Defaults to env var ZERO_USER_HASH.
   * In MCP context: set via the MCP server's env config in Claude Desktop.
   */
  userHash?: string;
  /**
   * Zero Platform API base URL.
   * Defaults to env var ZERO_PLATFORM_URL or the production URL.
   */
  platformApiUrl?: string;
  /**
   * Platform identifier. Auto-detected if omitted:
   *   1. ZERO_PLATFORM env var
   *   2. MCP SDK in process → 'mcp'
   *   3. 'custom'
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
