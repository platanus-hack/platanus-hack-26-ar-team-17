import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAgent } from '@/lib/services/agent.service';
import { resolveInternalUserIdByHash } from '@/lib/services/profile.service';
import { buildHmacPayload, decryptSecret, verifyHmacSignature } from '@/lib/utils/crypto';
import { consumeNonce } from '@/lib/services/nonce.service';
import { issueToken } from '@/lib/services/token.service';
import { writeLog } from '@/lib/services/auditLog.service';
import { supabase } from '@/lib/db/supabase';
import { config } from '@/lib/config';

const CLOCK_SKEW_MS = 5 * 60 * 1000;

// Default points at the pre-seeded test account (pitchr-test@example.com).
// Override via DEMO_USER_HASH env var if you want every run booked under a different user.
const DEFAULT_DEMO_USER_HASH = 'd7c0fe05915e8593931fd2697be15744';

export const runtime = 'nodejs';

type TraceEvent = {
  phase: string;
  ts_ms: number;
  ok?: boolean;
  data: Record<string, unknown>;
};

const MCP_URL = 'https://xmcp-x402-sim.vercel.app/mcp';
const MCP_RESOURCE = 'https://api.example.com/premium/weather';
const MCP_PAYER = '0xPayer000000000000000000000000000000000001';

function preview(s: string, head = 8, tail = 4) {
  if (!s) return '';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function parseSseJson(text: string): unknown {
  // Streamable-HTTP MCP responses come back as a single SSE message:
  //   event: message\ndata: {...}\n\n
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    }
  }
  // Fallback: maybe it was plain JSON.
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const trace: TraceEvent[] = [];
  const startedAt = Date.now();
  const log = (phase: string, data: Record<string, unknown>, ok = true) => {
    trace.push({ phase, ts_ms: Date.now() - startedAt, ok, data });
  };

  // ── 0. Resolve the demo user (no login required — uses a fixed test account)
  // Sanitize: tolerate someone pasting "DEMO_USER_HASH=<value>" into the env var
  // by stripping a leading "DEMO_USER_HASH=" / "KEY=" prefix and surrounding quotes.
  const rawHash = (process.env.DEMO_USER_HASH ?? '').trim();
  const stripped = rawHash
    .replace(/^DEMO_USER_HASH\s*=\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  const looksLikeHash = /^[a-f0-9]{32,128}$/i.test(stripped);
  const demoHash = looksLikeHash ? stripped : DEFAULT_DEMO_USER_HASH;

  const demoUserId = await resolveInternalUserIdByHash(demoHash);
  if (!demoUserId) {
    return NextResponse.json(
      {
        error: 'demo_user_missing',
        message: `no users row matches demo hash ${demoHash.slice(0, 8)}…`,
      },
      { status: 500 },
    );
  }

  // ── 1. Mint a fresh demo agent under the test account ─────────────────────
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(2).toString('hex');
  const agentName = `demo-${stamp}-${suffix}`;
  let agentId: string;
  let apiSecret: string;
  let apiKeyPrefix: string | null = null;
  try {
    const created = await createAgent({
      userId: demoUserId,
      name: agentName,
      type: 'agent',
      platform: 'demo',
    });
    agentId = created.agent.id;
    apiSecret = created.apiSecret;
    apiKeyPrefix = created.key?.prefix ?? null;
    log('agent_created', {
      agentId,
      name: agentName,
      apiKeyPrefix,
      apiSecretPreview: preview(apiSecret),
    });
  } catch (err) {
    log('agent_created', { error: (err as Error).message }, false);
    return NextResponse.json({ trace, error: 'agent_create_failed' }, { status: 500 });
  }

  // ── 2. Sign HMAC payload (the SDK does exactly this) ───────────────────────
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const action = 'call_tool';
  const platform = 'mcp';
  const payload = buildHmacPayload(agentId, timestamp, nonce, action, platform);
  const signature = crypto.createHmac('sha256', apiSecret).update(payload).digest('hex');
  log('signed', {
    payload,
    timestamp,
    nonce,
    action,
    platform,
    signaturePreview: preview(signature, 16, 8),
  });

  // ── 3. Run the same validation logic /api/validate runs — but in-process ──
  //    (Vercel deployment protection intercepts internal HTTP self-calls and
  //    returns an HTML auth page, breaking the previous fetch-based approach.)
  let token: string | null = null;
  let expiresAt: string | null = null;
  try {
    const ts = Date.parse(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) {
      log('validated', { allowed: false, reason: 'timestamp_skew' }, false);
      return NextResponse.json({ trace, error: 'validation_denied' }, { status: 200 });
    }

    const { data: agentRow } = await supabase
      .from('agents')
      .select('id, user_id, status, secret_enc')
      .eq('id', agentId)
      .eq('status', 'ACTIVE')
      .single<{ id: string; user_id: string; status: string; secret_enc: string | null }>();

    if (!agentRow || !agentRow.secret_enc || !config.ENCRYPTION_KEY) {
      log('validated', { allowed: false, reason: 'agent_not_found_or_no_key' }, false);
      return NextResponse.json({ trace, error: 'validation_denied' }, { status: 200 });
    }

    const nonceExpiresAt = new Date(ts + CLOCK_SKEW_MS);
    const nonceOk = await consumeNonce(nonce, agentId, nonceExpiresAt);
    if (!nonceOk) {
      log('validated', { allowed: false, reason: 'nonce_replay' }, false);
      return NextResponse.json({ trace, error: 'validation_denied' }, { status: 200 });
    }

    const secret = decryptSecret(agentRow.secret_enc, config.ENCRYPTION_KEY);
    if (!verifyHmacSignature(secret, payload, signature)) {
      log('validated', { allowed: false, reason: 'hmac_mismatch' }, false);
      void writeLog({ agentId, userId: agentRow.user_id, action, platform, result: 'BLOCKED_INVALID_KEY' });
      return NextResponse.json({ trace, error: 'validation_denied' }, { status: 200 });
    }

    const issued = await issueToken({ agentId, userId: agentRow.user_id });
    token = issued.token;
    expiresAt = issued.expiresAt;
    void writeLog({ agentId, userId: agentRow.user_id, action, platform, result: 'SUCCESS' });

    log('validated', {
      status: 200,
      allowed: true,
      tokenPreview: preview(token, 12, 6),
      expiresAt,
    });
  } catch (err) {
    log('validated', { error: (err as Error).message }, false);
    return NextResponse.json({ trace, error: 'validate_failed' }, { status: 500 });
  }

  // ── 4. Initialize MCP session (Streamable HTTP, stateless) ─────────────────
  const mcpHeaders = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2025-06-18',
    authorization: `Bearer ${token}`,
    'x-zero-agent-id': agentId,
  };

  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'zero-demo', version: '0.1' },
        },
      }),
    });
    const text = await res.text();
    const parsed = parseSseJson(text) as
      | { result?: { serverInfo?: { name: string; version: string } } }
      | null;
    log('mcp_init', {
      status: res.status,
      server: parsed?.result?.serverInfo ?? null,
    });
  } catch (err) {
    log('mcp_init', { error: (err as Error).message }, false);
  }

  // ── 5. Real MCP tools/call → pay_and_fetch (full x402 round-trip) ──────────
  let mcpResult: unknown = null;
  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: mcpHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'pay_and_fetch',
          arguments: { resource: MCP_RESOURCE, payerAddress: MCP_PAYER },
        },
      }),
    });
    const text = await res.text();
    const parsed = parseSseJson(text) as
      | { result?: { content?: { type: string; text: string }[] } }
      | null;
    const inner = parsed?.result?.content?.[0]?.text;
    if (inner) {
      try {
        mcpResult = JSON.parse(inner);
      } catch {
        mcpResult = inner;
      }
    }
    log('mcp_response', { status: res.status, tool: 'pay_and_fetch', result: mcpResult });
  } catch (err) {
    log('mcp_response', { error: (err as Error).message }, false);
  }

  log('done', { agentId, success: mcpResult !== null });

  return NextResponse.json({
    success: true,
    agent: { id: agentId, name: agentName, apiKeyPrefix, apiSecretPreview: preview(apiSecret) },
    validate: { tokenPreview: token ? preview(token, 12, 6) : null, expiresAt },
    mcpResult,
    trace,
  });
}
