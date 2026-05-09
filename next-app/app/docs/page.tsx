import Link from 'next/link';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {label && (
        <p style={{ ...mono, fontSize: 10, color: '#5a5a5a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          {label}
        </p>
      )}
      <pre style={{
        ...mono, fontSize: 13, lineHeight: 1.7,
        background: 'rgba(0,0,0,0.6)', border: '1px solid #1e1e1e',
        borderRadius: 10, padding: '18px 22px',
        color: '#f0f0f0', overflowX: 'auto', margin: 0,
        whiteSpace: 'pre',
      }}>
        {code}
      </pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(200,245,66,0.07)', border: '1px solid rgba(200,245,66,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...mono, fontSize: 11, color: '#c8f542',
        }}>
          {n}
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>{title}</h2>
      </div>
      <div style={{ marginLeft: 44 }}>{children}</div>
    </div>
  );
}

export default function DocsPage() {
  const platformUrl = 'https://zero-dnvh8x7x6-martinpulis-projects.vercel.app';

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#f0f0f0' }}>
      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 48px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(5,5,5,0.9)', backdropFilter: 'blur(20px)',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
            fontWeight: 600, fontSize: 18, letterSpacing: '-0.05em', color: '#f0f0f0',
          }}>
            zero<span style={{ color: '#c8f542' }}>.</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login" style={{
            ...mono, fontSize: 12, color: '#8a8a8a', textDecoration: 'none',
            padding: '7px 14px', borderRadius: 6,
          }}>
            Sign in
          </Link>
          <Link href="/register" style={{
            ...mono, fontSize: 12, color: '#050505', textDecoration: 'none',
            padding: '7px 14px', borderRadius: 6,
            background: '#c8f542',
          }}>
            Get started →
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 48px 100px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ ...mono, fontSize: 10, color: '#c8f542', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            SDK Integration
          </p>
          <h1 style={{
            fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
            fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15,
            margin: '0 0 16px',
          }}>
            Add Zero to your agent<br />in 10 minutes.
          </h1>
          <p style={{ fontSize: 15, color: '#8a8a8a', lineHeight: 1.7, margin: 0 }}>
            The SDK intercepts every action your agent wants to take and validates it against your API key before executing.
          </p>
        </div>

        <Step n={1} title="Install">
          <CodeBlock label="npm" code="npm install @zero-gate/sdk" />
          <p style={{ ...mono, fontSize: 11, color: '#5a5a5a', marginTop: -16, lineHeight: 1.6 }}>
            No registry yet? Add via path:{' '}
            <code style={{ color: '#8a8a8a' }}>"@zero-gate/sdk": "file:../path-to-sdk"</code>
          </p>
        </Step>

        <Step n={2} title="Initialize with your platform URL">
          <CodeBlock
            label="TypeScript / JavaScript"
            code={`import { ZeroGateSDK } from '@zero-gate/sdk';

const sdk = new ZeroGateSDK({
  platformApiUrl: '${platformUrl}',
});`}
          />
        </Step>

        <Step n={3} title="Call sdk.run() before every action">
          <CodeBlock
            label="usage"
            code={`const result = await sdk.run({
  apiKey: 'ak_your_key_here',  // from your dashboard
  action: 'send_message',       // what the agent wants to do
  platform: 'whatsapp',         // channel
  text: 'Hello!',               // message content (optional)
});

if (result.allowed) {
  // ✓ execute the action
} else {
  // ✗ blocked — result.error has the reason
  console.log('blocked:', result.error);
}`}
          />
        </Step>

        <Step n={4} title="Handle the result">
          <CodeBlock
            label="PipelineResult type"
            code={`// Allowed
{ allowed: true, token: string, userId: string }

// Blocked
{ allowed: false, error: 'invalid_api_key' | 'action_not_permitted' }`}
          />
        </Step>

        {/* Security note */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e',
          borderRadius: 12, padding: '22px 26px', marginBottom: 48,
        }}>
          <p style={{ ...mono, fontSize: 10, color: '#5a5a5a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Security
          </p>
          <ul style={{ fontSize: 13, color: '#8a8a8a', lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
            <li>Your API key is never sent in plain text — hashed with SHA-256 before every request.</li>
            <li>HTTPS is enforced. Passing an <code style={{ ...mono, fontSize: 12 }}>http://</code> URL throws at startup.</li>
            <li>All requests are logged in your audit trail.</li>
          </ul>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', paddingTop: 16 }}>
          <p style={{ fontSize: 15, color: '#8a8a8a', marginBottom: 20 }}>
            Ready to add identity to your agents?
          </p>
          <Link href="/register" style={{
            ...mono, fontSize: 13, fontWeight: 500,
            padding: '13px 28px', borderRadius: 8,
            background: '#c8f542', color: '#050505',
            textDecoration: 'none',
          }}>
            Create your account →
          </Link>
        </div>
      </div>
    </div>
  );
}
