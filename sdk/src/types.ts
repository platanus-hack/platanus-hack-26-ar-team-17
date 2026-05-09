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

export interface ValidationResponse {
  allowed: boolean;
}

export interface PipelineResult {
  allowed: boolean;
}
