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
}

export interface AgentRequest {
  /** Optional payload / text content to validate against global rules */
  text?: string;
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
