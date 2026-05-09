/**
 * SDK Integration Test
 * Runs the full ZeroGateSDK pipeline against the real local Platform API.
 *
 * The SDK enforces HTTPS in production. For local dev we wire the same
 * pipeline functions through a plain http client so we can test against
 * http://localhost:3001 without changing production code.
 *
 * Run: npx ts-node integration.ts
 */

import crypto from 'crypto';
import http from 'http';
import { verifyScope } from './src/pipeline/verifyScope';
import { verifyRules } from './src/pipeline/verifyRules';
import { normalizeAction } from './src/normalize/action';
import { normalizeText } from './src/normalize/text';
import type { ValidationResponse, PipelineResult } from './src/types';

// ── config ────────────────────────────────────────────────────────────────────
const PLATFORM_API = 'http://localhost:3001';
const API_KEY      = 'ak_YM0eBrMdz7k7RipfDIs2-9zzA2I0M3yTZp-y7YMnZ4c';

// ── helpers ───────────────────────────────────────────────────────────────────
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function httpPost(path: string, body: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: 'localhost', port: 3001, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve(JSON.parse(raw)));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Mirrors ZeroGateSDK.run() — same 5-step pipeline, http transport for localhost
async function runPipeline(
  apiKey: string,
  action: string,
  platform: string,
  text = ''
): Promise<PipelineResult> {
  // Step 1+2 — validate key hash against Platform API, receive token + scope
  const apiResponse = await httpPost('/api/validate', {
    api_key_hash: hashKey(apiKey),
    action: normalizeAction(action),
    platform,
    text: normalizeText(text),
  }) as ValidationResponse & { token?: string; scope?: string[] };

  if (!apiResponse.token) {
    return { allowed: false, error: (apiResponse as any).error ?? 'invalid_api_key' };
  }

  // Step 3 — scope check (SDK-side, same logic as ZeroGateSDK)
  if (!verifyScope(action, apiResponse.scope ?? [])) {
    return { allowed: false, error: 'action_not_permitted' };
  }

  // Step 4 — rules check (SDK-side)
  const rules = verifyRules({ apiResponse: { ...apiResponse, valid: true } });
  if (rules.blocked) return { allowed: false, error: rules.error };

  // Step 5 — approved
  return { allowed: true, token: apiResponse.token, userId: apiResponse.userId };
}

// ── scenarios ─────────────────────────────────────────────────────────────────
async function run() {
  console.log('='.repeat(60));
  console.log(' ZeroGateSDK — Integration test against http://localhost:3001');
  console.log('='.repeat(60));

  const cases: Array<{ label: string; action: string; text?: string; expect: 'allowed' | 'blocked' }> = [
    { label: 'send_message (in scope, clean text)',       action: 'send_message',  text: 'Hello!',             expect: 'allowed'  },
    { label: 'read_messages (in scope)',                  action: 'read_messages', text: '',                    expect: 'allowed'  },
    { label: 'create_post (in scope)',                    action: 'create_post',   text: 'Check this out',      expect: 'allowed'  },
    { label: 'delete_post (NOT in scope)',                action: 'delete_post',   text: '',                    expect: 'blocked'  },
    { label: 'mass_send (forbidden action rule)',         action: 'mass_send',     text: '',                    expect: 'blocked'  },
    { label: 'send_message + forbidden keyword in text',  action: 'send_message',  text: 'buy now click here',  expect: 'blocked'  },
    { label: 'SEND_MESSAGE uppercase (normalised)',       action: 'SEND_MESSAGE',  text: 'hi',                  expect: 'allowed'  },
    { label: 'invalid api key',                          action: 'send_message',  text: '',                    expect: 'blocked'  }, // uses wrong key
  ];

  let passed = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const key = i === cases.length - 1 ? 'ak_INVALID_KEY_FOR_TEST' : API_KEY;

    const result = await runPipeline(key, c.action, 'whatsapp', c.text);
    const ok = c.expect === 'allowed' ? result.allowed : !result.allowed;

    const status = ok ? '✅ PASS' : '❌ FAIL';
    const detail = result.allowed
      ? `allowed  | token: ${result.token?.slice(0, 20)}...`
      : `blocked  | error: ${result.error}`;

    console.log(`\n[${String(i + 1).padStart(2, '0')}] ${status} — ${c.label}`);
    console.log(`     ${detail}`);
    if (ok) passed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(` Result: ${passed}/${cases.length} passed`);
  console.log('='.repeat(60));

  if (passed !== cases.length) process.exit(1);
}

run().catch((err) => { console.error(err); process.exit(1); });
