export interface SDKConfig {
  /**
   * API key for the agent. Defaults to env var ZERO_API_KEY.
   * In MCP context: set via the MCP server's env config in Claude Desktop.
   * Required when using API key auth mode (agentId/privateKey not provided).
   */
  apiKey?: string;
  /**
   * User hash. Defaults to env var ZERO_USER_HASH.
   * Required when using API key auth mode.
   */
  userHash?: string;
  /**
   * Agent UUID from the zero. platform (returned by POST /api/agents/register).
   * Required when using Ed25519 challenge-response auth mode.
   */
  agentId?: string;
  /**
   * Ed25519 private key seed as a 64-char hex string (32 raw bytes).
   * Defaults to env var ZERO_PRIVATE_KEY.
   * Required when using Ed25519 challenge-response auth mode.
   * The key is held in memory only and never sent over the network.
   */
  privateKey?: string;
}

export interface ValidationResponse {
  allowed: boolean;
}

export interface PipelineResult {
  allowed: boolean;
}
