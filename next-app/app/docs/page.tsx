import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Developer Docs',
  description: 'Add Zero identity checks to an AI agent or MCP server.',
};

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
          <span style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px 8px 0 0', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none' }}>
            {label}
          </span>
        </div>
      )}
      <pre style={{
        ...mono,
        fontSize: 13,
        lineHeight: 1.75,
        background: '#080808',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: label ? '0 8px 8px 8px' : 8,
        padding: '18px 22px',
        color: '#e8e8e8',
        overflowX: 'auto',
        margin: 0,
        whiteSpace: 'pre',
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
        <h2 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: 0, margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(200,245,66,0.04)', border: '1px solid rgba(200,245,66,0.15)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 20%, black, transparent)',
      }} />

      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px clamp(20px, 6vw, 48px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(5,5,5,0.92)', backdropFilter: 'blur(20px)',
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
            Developer docs / SDK v1.0.3
          </span>
          <h1 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 38, fontWeight: 700, letterSpacing: 0, lineHeight: 1.1, margin: '0 0 18px' }}>
            Add accountable identity<br />to your agent.
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.75, margin: 0, maxWidth: 620 }}>
            Zero links an AI agent or MCP server to the human account that created it. Call the SDK before a real-world action, and Zero verifies the runtime, returns a short-lived token, and records the action for audit.
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
          <CodeBlock label="npm" code="npm install @zero-gate/sdk" />
          <p style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', marginTop: -8, lineHeight: 1.8 }}>
            Local repo install: <code style={{ color: 'var(--text-dim)' }}>npm install ../sdk/zero-gate-sdk-1.0.3.tgz</code>
          </p>
        </Section>

        <Section tag="02" title="Create an agent">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            In the dashboard, create one agent per runtime you want to identify. Copy the agent ID and the API secret when it is shown. The secret is meant to be stored once in the agent environment.
          </p>
          <CodeBlock
            label="Dashboard result"
            code={`ZERO_AGENT_ID=0f6f7f64-8c7f-4a8f-bcf1-8d33d624f2a1
ZERO_API_SECRET=zgs_...`}
          />
          <InfoBox>
            For new integrations, use <code style={mono}>ZERO_AGENT_ID</code> + <code style={mono}>ZERO_API_SECRET</code>. The older <code style={mono}>ZERO_API_KEY</code> + <code style={mono}>ZERO_USER_HASH</code> flow still exists for compatibility, but it is not the recommended path.
          </InfoBox>
        </Section>

        <Section tag="03" title="Configure the runtime">
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
        </Section>

        <Section tag="04" title="Guard real actions">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            Create the SDK once, then call <code style={mono}>run()</code> immediately before a meaningful side effect. Use named functions so audit logs show clear action names.
          </p>
          <CodeBlock
            label="usage"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

export async function sendMessage(text: string) {
  const auth = await zero.run();

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
};`}
          />
        </Section>

        <Section tag="05" title="MCP server pattern">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            Put the check at the edge of each tool handler. If Zero blocks the runtime, return a normal tool response and skip the side effect.
          </p>
          <CodeBlock
            label="mcp-server.ts"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const auth = await zero.run();

  if (!auth.allowed) {
    return {
      content: [{ type: 'text', text: 'Blocked by Zero identity check.' }],
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

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 12, padding: '22px 26px', marginBottom: 48 }}>
          <p style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Security notes</p>
          <BulletList
            items={[
              <>The HMAC secret is never sent directly. The SDK sends a timestamp, nonce, action, platform, and signature.</>,
              <>Nonces are single-use and timestamps outside the allowed clock window are rejected.</>,
              <>Agents are platform-bound unless they are registered for <code style={mono}>all</code>.</>,
              <>Disable an agent from the dashboard to block future validations. Existing SDK tokens expire shortly after.</>,
              <>Call Zero before irreversible work, not after it. The audit trail is most useful at the action boundary.</>,
            ]}
          />
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
