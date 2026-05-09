/**
 * SDK integration test against a local Platform API.
 *
 * Run with a local API server available:
 * ZERO_API_KEY=ak_... ZERO_USER_HASH=... npm run integration
 */

import http from 'http';

interface ValidateResponse {
  allowed: boolean;
}

const PLATFORM_API = process.env.ZERO_PLATFORM_API_URL ?? 'http://localhost:3001';
const API_KEY = process.env.ZERO_API_KEY ?? '';
const USER_HASH = process.env.ZERO_USER_HASH ?? '';

if (!API_KEY || !USER_HASH) {
  throw new Error('Set ZERO_API_KEY and ZERO_USER_HASH before running integration');
}

function httpPost(path: string, body: unknown): Promise<ValidateResponse> {
  const baseUrl = new URL(PLATFORM_API);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: baseUrl.hostname,
        port: baseUrl.port || 3001,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => resolve(JSON.parse(raw)));
      }
    );

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function validate(params: {
  token: string;
  hash: string;
  action: string;
  platform: string;
}): Promise<ValidateResponse> {
  return httpPost('/api/validate', params);
}

async function run() {
  const cases: Array<{
    label: string;
    token: string;
    hash: string;
    action: string;
    expected: boolean;
  }> = [
    { label: 'valid credentials',                       token: API_KEY,                   hash: USER_HASH,               action: 'send_message', expected: true  },
    { label: 'valid credentials with arbitrary action', token: API_KEY,                   hash: USER_HASH,               action: 'mass_send',    expected: true  },
    { label: 'invalid api key',                         token: 'ak_INVALID_KEY_FOR_TEST', hash: USER_HASH,               action: 'send_message', expected: false },
    { label: 'invalid user hash',                       token: API_KEY,                   hash: 'invalid_hash_for_test', action: 'send_message', expected: false },
  ];

  let passed = 0;

  for (const testCase of cases) {
    const result = await validate({
      token: testCase.token,
      hash: testCase.hash,
      action: testCase.action,
      platform: 'mcp',
    });

    const ok = result.allowed === testCase.expected;
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${testCase.label}: allowed=${result.allowed}`);
    if (ok) passed++;
  }

  if (passed !== cases.length) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
