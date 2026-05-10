import crypto from 'crypto';

const RUN_LIVE = process.env.PITCHR_E2E === 'true';
const liveIt = RUN_LIVE ? it : it.skip;
const PITCHR_MCP_URL = 'https://www.pitchr.studio/mcp';

function buildHmacHeaders(agentId: string, apiSecret: string, action = 'call_tool') {
  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = new Date().toISOString();
  const platform = 'mcp';
  const payload = `${agentId}|${timestamp}|${nonce}|${action}|${platform}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  return {
    'x-zero-agent-id': agentId,
    'x-zero-timestamp': timestamp,
    'x-zero-nonce': nonce,
    'x-zero-action': action,
    'x-zero-platform': platform,
    'x-zero-signature': signature,
  };
}

describe('Phase 2: live MCP call to pitchr.studio (skipped unless PITCHR_E2E=true)', () => {
  const agentId = process.env.ZERO_AGENT_ID!;
  const apiSecret = process.env.ZERO_API_SECRET!;

  async function connectClient() {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/streamableHttp.js'
    );
    const transport = new StreamableHTTPClientTransport(new URL(PITCHR_MCP_URL), {
      requestInit: { headers: buildHmacHeaders(agentId, apiSecret) },
    });
    const client = new Client({ name: 'zero-e2e', version: '1.0.0' }, {});
    await client.connect(transport);
    return client;
  }

  liveIt('connects and finds list_judges in tool list', async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    expect(tools.some(t => t.name === 'list_judges')).toBe(true);
    await client.close();
  });

  liveIt('calls list_judges and receives a non-empty response', async () => {
    const client = await connectClient();
    const result = await client.callTool({ name: 'list_judges', arguments: {} });
    expect(result).toBeDefined();
    expect(result.content).toBeTruthy();
    await client.close();
  });
});
