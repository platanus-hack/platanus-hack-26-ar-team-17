/**
 * Auto-detects platform & action from the runtime environment.
 * Internal — never exposed to the user.
 */

export const PLATFORM_API_URL = 'https://next-app-ochre-zeta.vercel.app';

export function detectPlatform(): string {
  if (typeof process === 'undefined') return 'custom';
  if (process.env.ZERO_PLATFORM) return process.env.ZERO_PLATFORM;

  try {
    require.resolve('@modelcontextprotocol/sdk');
    return 'mcp';
  } catch {}

  return 'custom';
}

/**
 * Inspects the call stack to infer the action name.
 * Walks back past internal SDK frames and uses the first user-land function name.
 * Falls back to 'execute' if not determinable.
 */
export function detectAction(): string {
  const err = new Error();
  const stack = err.stack ?? '';
  const lines = stack.split('\n').slice(1);

  for (const raw of lines) {
    const line = raw.trim();
    if (line.includes('zero-gate/sdk') || line.includes('@zero-gate')) continue;
    if (line.includes('node_modules')) continue;
    if (line.includes('platform/detect')) continue;
    if (line.includes('ZeroGateSDK')) continue;

    const m = line.match(/at\s+(?:async\s+)?([^\s(]+)\s*\(/);
    if (m && m[1] && !['Object.<anonymous>', 'Module._compile'].includes(m[1])) {
      const name = m[1].split('.').pop()!;
      if (name && name !== 'run' && !name.startsWith('_')) return name;
    }
  }
  return 'execute';
}
