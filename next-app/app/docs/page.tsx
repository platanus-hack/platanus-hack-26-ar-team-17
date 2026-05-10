import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShaderBg } from '@/components/ui/page-shader-bg';

export const metadata: Metadata = {
  title: 'Developer Docs',
  description: 'Add Zero identity checks to an AI agent or MCP server.',
};

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

const AI_PROMPT = `You are integrating the @zero-gate/sdk@1.0.3 into an existing TypeScript/JavaScript
agent or MCP server. ZeroGate is an identity layer that signs every action with HMAC-SHA256,
sends it to the Platform API, and returns { allowed, token? } before the action runs.

Follow this contract — do not invent fields:

1. Install: \`npm install @zero-gate/sdk@1.0.3\` (or pnpm/yarn equivalent).
   If the registry version is unavailable, install from
   https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/sdk/zero-gate-sdk-1.0.3.tgz

2. Ask the developer for two values, nothing else. Both come from
   https://platanus-hack-26-ar-team-17.vercel.app/agents (click "view credentials"):
   - Agent ID  → env var ZERO_AGENT_ID  (UUID)
   - API Secret → env var ZERO_API_SECRET (long base64url string)

3. Initialize once at the entry point. The SDK reads creds from process.env:
     import { ZeroGateSDK } from '@zero-gate/sdk';
     const zero = new ZeroGateSDK();
   Override only when local dev points at a non-prod ZeroGate:
     new ZeroGateSDK({ platformApiUrl: process.env.ZERO_PLATFORM_API_URL });

4. Wrap every agent action. \`action\` and \`platform\` are AUTO-DETECTED — pass nothing.
     async function sendMessage(text: string) {
       const result = await zero.run();
       if (!result.allowed) return;     // blocked, audit log on platform
       await deliverToWhatsapp(text);
     }

5. For MCP servers, wrap inside the request handler. The MCP tool name becomes the action:
     server.setRequestHandler(CallToolRequestSchema, async (req) => {
       const r = await zero.run();
       if (!r.allowed) {
         return { content: [{ type: 'text', text: 'ZeroGate blocked: denied_by_platform' }], isError: true };
       }
       // execute tool…
     });

Constraints:
- Never store the API secret in source. Only env vars.
- HTTPS-only — the SDK throws on http:// platformApiUrl.
- Do not pass legacy fields (apiKey, userHash, action, platform, text). HMAC mode is the only mode.
- After integrating, list every file changed and every action that was gated. Skip read-only init code.

Report: files modified, actions wrapped, env vars added.`;

const SKILL_MD = `---
name: zerogate-integrate
description: Integrates the ZeroGate SDK (HMAC mode) into an agent or MCP server. Installs @zero-gate/sdk, asks for Agent ID + API Secret, initializes the SDK, and wraps each action with sdk.run(). Trigger with "integrate ZeroGate", "add ZeroGate to my agent", or "add zero. to my project".
---

# ZeroGate SDK Integration

Wrap every agent action with HMAC-signed validation. v1.0.3 contract.

## Steps

1. Install \`@zero-gate/sdk@1.0.3\`.
2. Ask the user for Agent ID + API Secret from https://platanus-hack-26-ar-team-17.vercel.app/agents.
3. Add \`ZERO_AGENT_ID\` and \`ZERO_API_SECRET\` to env / .env.example.
4. Initialize once: \`const zero = new ZeroGateSDK();\` (creds read from env).
5. Before every action call:
   \`\`\`ts
   const r = await zero.run();
   if (!r.allowed) return;
   // proceed
   \`\`\`
6. Report files changed, actions gated, env vars added.

## Notes

- \`action\` and \`platform\` are auto-detected from the call stack — never pass them.
- API secret never travels in plaintext; the SDK signs HMAC-SHA256 over agentId|ts|nonce|action|platform.
- Block reasons appear in the audit log on the platform dashboard, not in the SDK response.
`;

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <span style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 14px', background: 'rgba(8,8,8,0.7)', borderRadius: '8px 8px 0 0', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none', backdropFilter: 'blur(10px)' }}>
            {label}
          </span>
        </div>
      )}
      <pre style={{
        ...mono,
        fontSize: 13,
        lineHeight: 1.75,
        background: 'rgba(8,8,8,0.78)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: label ? '0 8px 8px 8px' : 8,
        padding: '18px 22px',
        color: '#e8e8e8',
        overflowX: 'auto',
        margin: 0,
        whiteSpace: 'pre',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}>
        {code}
      </pre>
    </div>
  );
}

function CopyableBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <span style={{ ...mono, fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 14px', background: 'rgba(200,245,66,0.08)', borderRadius: '8px 8px 0 0', border: '1px solid rgba(200,245,66,0.22)', borderBottom: 'none', backdropFilter: 'blur(10px)' }}>
            {label}
          </span>
        </div>
      )}
      <pre style={{
        ...mono, fontSize: 12.5, lineHeight: 1.7,
        background: 'rgba(7,9,7,0.78)',
        border: '1px solid rgba(200,245,66,0.2)',
        borderRadius: label ? '0 8px 8px 8px' : 8,
        padding: '20px 22px',
        color: '#e8e8e8', overflowX: 'auto', margin: 0,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 460, overflowY: 'auto',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}>
        {code}
      </pre>
    </div>
  );
}

function Section({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 56, paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {tag && (
          <span style={{ ...mono, fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(200,245,66,0.07)', border: '1px solid rgba(200,245,66,0.2)', padding: '3px 9px', borderRadius: 999 }}>
            {tag}
          </span>
        )}
        <h2 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: 0, margin: 0, textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(200,245,66,0.05)', border: '1px solid rgba(200,245,66,0.18)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.9, paddingLeft: 18, margin: '0 0 18px' }}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function DocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', position: 'relative' }}>
      <PageShaderBg veilOpacity={0.68} />

      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px clamp(20px, 6vw, 48px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(5,5,5,0.55)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontWeight: 600, fontSize: 18, letterSpacing: 0, color: 'var(--text)' }}>
            zero
          </span>
          <span style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 600 }}>.</span>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/login" style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', padding: '7px 14px', borderRadius: 6 }}>
            Sign in
          </Link>
          <Link href="/login" style={{ ...mono, fontSize: 12, color: '#050505', textDecoration: 'none', padding: '7px 14px', borderRadius: 6, background: 'var(--accent)', fontWeight: 600 }}>
            Get started -&gt;
          </Link>
        </div>
      </nav>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '64px clamp(20px, 6vw, 48px) 120px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 64 }}>
          <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
            Developer docs / SDK v1.0.3 / HMAC mode
          </span>
          <h1 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 38, fontWeight: 700, letterSpacing: 0, lineHeight: 1.1, margin: '0 0 18px', textShadow: '0 4px 32px rgba(0,0,0,0.55)' }}>
            Add accountable identity<br />to your agent.
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.75, margin: 0, maxWidth: 620 }}>
            Zero links an AI agent or MCP server to the human account that created it. Call the SDK before a real-world action, and Zero verifies the runtime, signs it with HMAC-SHA256, returns a short-lived token, and records the action for audit.
          </p>
        </div>

        <Section tag="00" title="The contract">
          <InfoBox>
            Your app keeps doing the work. Zero answers one question first: is this named agent, running for this creator, allowed to take this action right now?
          </InfoBox>
          <BulletList
            items={[
              <>A human creates an agent in the Zero dashboard after signing in.</>,
              <>The agent runtime receives <code style={mono}>ZERO_AGENT_ID</code> and a secret or private key.</>,
              <>Your code calls <code style={mono}>zero.run()</code> before side effects like messages, tool calls, writes, purchases, or API mutations.</>,
              <>Zero validates the runtime proof and platform binding, then logs the action against the agent and creator.</>,
              <>If the agent is disabled or credentials do not match, <code style={mono}>allowed</code> is <code style={mono}>false</code>.</>,
            ]}
          />
        </Section>

        <Section tag="01" title="Install">
          <CodeBlock label="npm" code="npm install @zero-gate/sdk@1.0.3" />
          <p style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', marginTop: -8, lineHeight: 1.8 }}>
            Local repo install: <code style={{ color: 'var(--text-dim)' }}>npm install ../sdk/zero-gate-sdk-1.0.3.tgz</code><br />
            Not on npm yet? <code style={{ color: 'var(--text-dim)' }}>npm install https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/sdk/zero-gate-sdk-1.0.3.tgz</code>
          </p>
        </Section>

        <Section tag="02" title="Create an agent">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            In the dashboard, create one agent per runtime you want to identify. Open <Link href="/agents" style={{ color: 'var(--accent)' }}>/agents</Link>, hit <strong>view credentials</strong>, and copy the agent ID and API secret. The secret is shown once and is meant to be stored in the agent environment.
          </p>
          <CodeBlock
            label="dashboard → agents → view credentials"
            code={`ZERO_AGENT_ID=f47ac10b-58cc-4372-a567-0e02b2c3d479
ZERO_API_SECRET=hQv7…(long base64url string)…2k

# Headers when calling an MCP wrapper:
#   X-Zero-Agent-Id:    f47ac10b-58cc-4372-a567-0e02b2c3d479
#   X-Zero-Api-Secret:  hQv7…2k`}
          />
          <InfoBox>
            For new integrations, use <code style={mono}>ZERO_AGENT_ID</code> + <code style={mono}>ZERO_API_SECRET</code>. The older <code style={mono}>ZERO_API_KEY</code> + <code style={mono}>ZERO_USER_HASH</code> flow still exists for compatibility but is not the recommended path.
          </InfoBox>
        </Section>

        <Section tag="03" title="Configure the runtime">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            The SDK reads <code style={mono}>ZERO_AGENT_ID</code> and <code style={mono}>ZERO_API_SECRET</code> from env. Platform URL, action and caller platform are auto-detected — no other config needed.
          </p>
          <CodeBlock
            label=".env"
            code={`ZERO_AGENT_ID=0f6f7f64-8c7f-4a8f-bcf1-8d33d624f2a1
ZERO_API_SECRET=zgs_...

# Optional
ZERO_PLATFORM=mcp
ZERO_PLATFORM_API_URL=http://localhost:3000`}
          />
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            If <code style={mono}>ZERO_PLATFORM</code> is not set, the SDK detects MCP when <code style={mono}>@modelcontextprotocol/sdk</code> is installed. Otherwise it reports <code style={mono}>custom</code>.
          </p>
          <CodeBlock
            label="initialize"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();
// reads ZERO_AGENT_ID + ZERO_API_SECRET from process.env`}
          />
          <p style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 18px', lineHeight: 1.7 }}>
            Override creds when needed: <code style={{ color: 'var(--text-dim)' }}>{`new ZeroGateSDK({ agentId, apiSecret })`}</code>
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.7 }}>
            For an MCP server consumed via Claude Desktop, the user passes the credentials in the config:
          </p>
          <CodeBlock
            label="claude_desktop_config.json"
            code={`{
  "mcpServers": {
    "your-mcp-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "ZERO_AGENT_ID":   "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "ZERO_API_SECRET": "hQv7…2k"
      }
    }
  }
}`}
          />
        </Section>

        <Section tag="04" title="Guard real actions">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            Create the SDK once, then call <code style={mono}>run()</code> immediately before a meaningful side effect. The action is auto-inferred from the calling function name and the platform from the runtime — use named functions so audit logs show clear action names.
          </p>
          <CodeBlock
            label="usage"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

export async function sendMessage(text: string) {
  const auth = await zero.run();
  // action = 'sendMessage' (auto), platform = 'mcp' or 'custom' (auto)

  if (!auth.allowed) {
    return { ok: false, reason: 'blocked_by_zero' };
  }

  await deliverMessage(text);
  return { ok: true };
}`}
          />
          <CodeBlock
            label="RunResult"
            code={`type RunResult = {
  allowed: boolean;
  token?: string;   // cached for about 5 minutes
  receipt?: string; // present in Ed25519 challenge mode
};

// Allowed
{ allowed: true, token: 'eyJhbGciOi…' }

// Blocked
{ allowed: false }
// Detailed reason lives in the audit log:
//   /audit-log on the dashboard, with rule_violated set to one of
//   hmac_signature_mismatch | clock_skew | platform_mismatch:agent=X,request=Y |
//   encryption_key_missing | secret_decrypt_failed | hmac_schema_invalid`}
          />
        </Section>

        <Section tag="05" title="MCP server pattern">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            Put the check at the edge of each tool handler. If Zero blocks the runtime, return a normal tool response and skip the side effect.
          </p>
          <InfoBox>
            When <code style={mono}>@modelcontextprotocol/sdk</code> is installed, platform is auto-set to <span style={{ color: 'var(--accent)' }}>&apos;mcp&apos;</span>. Agents created in this MVP default to <code style={mono}>platform: &apos;all&apos;</code> so any caller is accepted.
          </InfoBox>
          <CodeBlock
            label="mcp-server.ts"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const auth = await zero.run();
  // action = MCP tool name (auto)

  if (!auth.allowed) {
    return {
      content: [{ type: 'text', text: 'ZeroGate blocked: denied_by_platform' }],
      isError: true,
    };
  }

  return executeTool(request.params);
});`}
          />
        </Section>

        <Section tag="06" title="Stronger keypair mode">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            If you do not want a shared HMAC secret in the runtime, register an Ed25519 public key and run the SDK with the private key. The private key never leaves the agent process; the backend verifies a signed one-time challenge.
          </p>
          <CodeBlock
            label="env"
            code={`ZERO_AGENT_ID=0f6f7f64-8c7f-4a8f-bcf1-8d33d624f2a1
ZERO_PRIVATE_KEY=64_hex_chars

# Optional post-quantum companion key
ZERO_PRIVATE_KEY_PQC=...`}
          />
          <InfoBox>
            Challenge mode uses <code style={mono}>/api/agent-auth/challenge</code> and <code style={mono}>/api/agent-auth/verify</code>. Successful verification returns a short-lived access token and, on fresh auth, a signed receipt.
          </InfoBox>
        </Section>

        <Section tag="07" title="Prompt for an AI assistant">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            Paste this into Claude / Cursor / Copilot Chat / any LLM that can edit your repo. It contains the full integration contract so the assistant won&apos;t invent fields.
          </p>
          <CopyableBlock label="copy → paste into your AI assistant" code={AI_PROMPT} />
        </Section>

        <Section tag="08" title="Claude Code skill">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            Save this as <code style={mono}>~/.claude/skills/zerogate-integrate/SKILL.md</code> and Claude Code will invoke it whenever you say things like &quot;integrate ZeroGate&quot; or &quot;add zero. to my project&quot;.
          </p>
          <CopyableBlock label="SKILL.md" code={SKILL_MD} />
        </Section>

        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--z-border)', borderRadius: 12, padding: '22px 26px', marginBottom: 48, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
          <p style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Security notes</p>
          <ul style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
            <li>The HMAC secret is never sent directly. The SDK signs <code style={mono}>agentId|timestamp|nonce|action|platform</code> and verifies it server-side.</li>
            <li>Validation runs over enforced HTTPS — the SDK throws on http://.</li>
            <li>Replay protection: a per-request <code style={mono}>nonce</code> is consumed once; reused nonces fail with <code style={mono}>BLOCKED_INVALID_KEY</code>.</li>
            <li>Clock skew &gt; 5 min is rejected and logged with <code style={mono}>rule_violated=clock_skew</code>.</li>
            <li>Agents are platform-bound unless registered for <code style={mono}>all</code>.</li>
            <li>Disable an agent from the dashboard to block future validations. Existing SDK tokens expire shortly after.</li>
            <li>Every <code style={mono}>run()</code> call — allowed or blocked — is appended to your audit log with a tamper-evident checksum chain.</li>
            <li>Call Zero before irreversible work, not after it. The audit trail is most useful at the action boundary.</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 20 }}>Ship agents that can answer for what they do.</p>
          <Link href="/login" style={{ ...mono, fontSize: 13, fontWeight: 600, padding: '12px 28px', borderRadius: 8, background: 'var(--accent)', color: '#050505', textDecoration: 'none' }}>
            Create your first agent -&gt;
          </Link>
        </div>
      </main>
    </div>
  );
}
