import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SDK Docs',
  description: 'Integrate the Zero SDK into your AI agent or MCP server in minutes.',
};

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

function CodeBlock({ code, label, lang = 'ts' }: { code: string; label?: string; lang?: string }) {
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
        ...mono, fontSize: 13, lineHeight: 1.75,
        background: '#080808',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: label ? '0 8px 8px 8px' : 8,
        padding: '18px 22px',
        color: '#e8e8e8', overflowX: 'auto', margin: 0,
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
        <h2 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>
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

export default function DocsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 20%, black, transparent)',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 48px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(5,5,5,0.92)', backdropFilter: 'blur(20px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontWeight: 600, fontSize: 18, letterSpacing: '-0.05em', color: 'var(--text)' }}>
            zero
          </span>
          <span style={{ color: 'var(--accent)', fontSize: 20, fontWeight: 600 }}>.</span>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/login" style={{ ...mono, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', padding: '7px 14px', borderRadius: 6 }}>
            Sign in
          </Link>
          <Link href="/register" style={{ ...mono, fontSize: 12, color: '#050505', textDecoration: 'none', padding: '7px 14px', borderRadius: 6, background: 'var(--accent)', fontWeight: 600 }}>
            Get started →
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '64px 48px 120px', position: 'relative', zIndex: 1 }}>

        {/* Hero */}
        <div style={{ marginBottom: 64 }}>
          <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16, display: 'block' }}>
            SDK Docs · v2
          </span>
          <h1 style={{ fontFamily: 'var(--font-grotesk-var), sans-serif', fontSize: 38, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 18px' }}>
            Add Zero to your agent<br />in 5 minutes.
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-dim)', lineHeight: 1.75, margin: 0, maxWidth: 560 }}>
            The SDK validates every action your agent or MCP server takes before it executes —
            with a full audit trail, automatic platform detection, and cryptographic key binding.
          </p>
        </div>

        {/* Step 1 — Install */}
        <Section tag="01" title="Install">
          <CodeBlock label="npm" code="npm install @zero-gate/sdk" />
          <p style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', marginTop: -8, lineHeight: 1.8 }}>
            Not on npm yet?{' '}
            <code style={{ color: 'var(--text-dim)' }}>npm install ../sdk/zero-gate-sdk-1.0.0.tgz</code>{' '}
            from this repo.
          </p>
        </Section>

        {/* Step 2 — Get credentials */}
        <Section tag="02" title="Get your credentials from the dashboard">
          <InfoBox>
            <span style={{ color: 'var(--accent)' }}>apiKey</span> — created per agent under <strong>API Keys</strong>. One key per agent or MCP server.<br />
            <span style={{ color: 'var(--accent)' }}>userHash</span> — your account identifier, visible in <strong>Settings</strong>. Shared across all your agents.
          </InfoBox>
          <CodeBlock
            label="Dashboard → API Keys → New Key"
            code={`apiKey:   ak_abc1234...   ← unique per agent
userHash: a1b2c3d4...   ← same for all your agents`}
          />
        </Section>

        {/* Step 3 — Initialize once */}
        <Section tag="03" title="Initialize — zero config">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            The SDK reads credentials from env vars. URL, platform and action are auto-detected — no extra config needed.
          </p>
          <CodeBlock
            label="server.ts"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();`}
          />
          <p style={{ ...mono, fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 18px', lineHeight: 1.7 }}>
            Override creds if needed: <code style={{ color: 'var(--text-dim)' }}>{`new ZeroGateSDK({ apiKey, userHash })`}</code>
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.7 }}>
            The user connecting to your MCP server provides the credentials via Claude Desktop config:
          </p>
          <CodeBlock
            label="claude_desktop_config.json"
            code={`{
  "mcpServers": {
    "your-mcp-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "ZERO_API_KEY":   "ak_abc1234...",
        "ZERO_USER_HASH": "a1b2c3d4..."
      }
    }
  }
}`}
          />
        </Section>

        {/* Step 4 — Run */}
        <Section tag="04" title="Wrap every action with sdk.run()">
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.7 }}>
            Call <code style={mono}>run()</code> before executing any action. The SDK auto-infers the action from the calling function name.
          </p>
          <CodeBlock
            label="usage"
            code={`async function sendMessage(text: string) {
  const result = await zero.run();
  // action='sendMessage' inferred from this function name

  if (!result.allowed) {
    console.error('blocked');
    return;
  }

  // ✓ proceed
  await deliverToWhatsapp(text);
}`}
          />

          <CodeBlock
            label="PipelineResult"
            code={`// Allowed
{
  allowed: true
}

// Blocked
{
  allowed: false
}`}
          />
        </Section>

        {/* MCP example */}
        <Section tag="05" title="MCP server example">
          <InfoBox>
            When <code style={mono}>@modelcontextprotocol/sdk</code> is installed, platform is automatically set to <span style={{ color: 'var(--accent)' }}>'mcp'</span> — no config needed.
          </InfoBox>
          <CodeBlock
            label="mcp-server.ts"
            code={`import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ZeroGateSDK } from '@zero-gate/sdk';

const zero = new ZeroGateSDK();
// platform = 'mcp' (auto), URL = production (auto)

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const result = await zero.run();
  // action = MCP tool name (auto-detected)

  if (!result.allowed) {
    return { content: [{ type: 'text', text: 'Blocked by Zero Gate' }] };
  }

  // execute tool...
});`}
          />
        </Section>

        {/* Security */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--z-border)', borderRadius: 12, padding: '22px 26px', marginBottom: 48 }}>
          <p style={{ ...mono, fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Security</p>
          <ul style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 2, paddingLeft: 18, margin: 0 }}>
            <li>API key validation happens over enforced HTTPS.</li>
            <li><code style={mono}>userHash</code> + <code style={mono}>apiKey</code> are cross-validated server-side — a leaked key alone is useless.</li>
            <li>Plain HTTP requests are rejected by the SDK transport.</li>
            <li>Every allowed <code style={mono}>run()</code> call is logged by the platform API.</li>
          </ul>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 20 }}>Ready to add identity to your agents?</p>
          <Link href="/register" style={{ ...mono, fontSize: 13, fontWeight: 600, padding: '12px 28px', borderRadius: 8, background: 'var(--accent)', color: '#050505', textDecoration: 'none' }}>
            Create your account →
          </Link>
        </div>

      </div>
    </div>
  );
}
