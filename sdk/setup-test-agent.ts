/**
 * Setup test agent in Supabase for SDK integration testing using REST API
 */

import http from 'http';
import https from 'https';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const PUBLIC_KEY = process.env.TEST_PUBLIC_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and TEST_PUBLIC_KEY before running setup');
}

function httpRequest<T>(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
    };

    const req = client.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(new Error(`Failed to parse response: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function setup() {
  try {
    const userId = crypto.randomUUID();
    const agentId = crypto.randomUUID();
    const userHash = crypto.randomBytes(16).toString('hex');
    const did = `did:zero:${agentId}`;

    const baseUrl = SUPABASE_URL.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    };

    // 1. Create test user
    const userData = {
      id: userId,
      email: `test-sdk-${Date.now()}@example.com`,
      kyc_status: 'VERIFIED',
      hash: userHash,
    };

    await httpRequest<any>(
      'POST',
      `${baseUrl}/rest/v1/users`,
      { ...headers, Prefer: 'return=representation' },
      JSON.stringify(userData),
    );

    console.log('✓ Created test user:', userId);

    // 2. Create test agent
    const agentData = {
      id: agentId,
      user_id: userId,
      name: 'test-mcp-agent',
      platform: 'mcp',
      type: 'agent',
      status: 'ACTIVE',
      public_key: PUBLIC_KEY,
      did: did,
    };

    await httpRequest<any>(
      'POST',
      `${baseUrl}/rest/v1/agents`,
      { ...headers, Prefer: 'return=representation' },
      JSON.stringify(agentData),
    );

    console.log('✓ Agent registered successfully:');
    console.log('');
    console.log('ZERO_AGENT_ID=' + agentId);
    console.log('ZERO_PRIVATE_KEY=811ee5b89d461f44fddcfcde631f750ed828dd93da8ed73a0dd6c56b46ae3764');
    console.log('');
  } catch (error) {
    console.error('✗ Failed to register agent:', (error as Error).message);
    process.exit(1);
  }
}

setup().catch((error) => {
  console.error(error);
  process.exit(1);
});
