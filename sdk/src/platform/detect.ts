/**
 * Auto-detects the platform from the runtime environment.
 * Priority: explicit config → ZERO_PLATFORM env → MCP process detection → 'custom'
 */
export function detectPlatform(explicit?: string): string {
  if (explicit) return explicit;

  // Env var override
  if (typeof process !== 'undefined' && process.env.ZERO_PLATFORM) {
    return process.env.ZERO_PLATFORM;
  }

  // MCP SDK loaded in process
  if (typeof process !== 'undefined') {
    try {
      require.resolve('@modelcontextprotocol/sdk');
      return 'mcp';
    } catch {}
  }

  return 'custom';
}
