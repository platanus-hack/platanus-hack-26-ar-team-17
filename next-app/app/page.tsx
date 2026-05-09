import Link from 'next/link';

const mono: React.CSSProperties = { fontFamily: 'var(--font-jetbrains), monospace' };

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#f0f0f0', position: 'relative', overflow: 'hidden' }}>
      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />
      {/* Glow */}
      <div style={{
        position: 'fixed', bottom: '-10%', right: '-5%', width: '55vw', height: '55vw',
        background: 'radial-gradient(circle, rgba(200,245,66,0.07) 0%, transparent 60%)',
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 48px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(20px)',
      }}>
        <span style={{
          fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
          fontWeight: 600, fontSize: 20, letterSpacing: '-0.05em',
        }}>
          zero<span style={{ color: '#c8f542' }}>.</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/docs" style={{
            ...mono, fontSize: 12, color: '#8a8a8a', textDecoration: 'none',
            padding: '8px 14px', borderRadius: 6,
            transition: 'color 120ms ease',
          }}
            onMouseOver={undefined}
          >
            Docs
          </Link>
          <Link href="/login" style={{
            ...mono, fontSize: 12, color: '#f0f0f0', textDecoration: 'none',
            padding: '8px 14px', borderRadius: 6,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            Sign in →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ paddingTop: 160, paddingBottom: 100, paddingLeft: 48, paddingRight: 48, maxWidth: 860, position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          ...mono, fontSize: 10, color: '#c8f542', letterSpacing: '0.1em', textTransform: 'uppercase',
          background: 'rgba(200,245,66,0.06)', border: '1px solid rgba(200,245,66,0.2)',
          padding: '5px 12px', borderRadius: 999, marginBottom: 32,
        }}>
          <span style={{ fontSize: 7 }}>●</span> Identity for AI Agents
        </div>

        <h1 style={{
          fontFamily: 'var(--font-grotesk-var), Space Grotesk, sans-serif',
          fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 600,
          letterSpacing: '-0.04em', lineHeight: 1.1,
          margin: '0 0 24px',
        }}>
          Every agent action,<br />
          <span style={{ color: '#c8f542' }}>validated.</span>
        </h1>

        <p style={{ fontSize: 18, color: '#8a8a8a', lineHeight: 1.7, maxWidth: 520, margin: '0 0 40px' }}>
          Issue cryptographic API keys to your AI agents. Validate every action before it runs. Revoke access instantly.
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login" style={{
            ...mono, fontSize: 13, fontWeight: 500,
            padding: '13px 24px', borderRadius: 8,
            background: '#c8f542', color: '#050505',
            textDecoration: 'none', transition: 'all 150ms ease',
          }}>
            Get started →
          </Link>
          <Link href="/docs" style={{
            ...mono, fontSize: 13,
            padding: '13px 24px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#f0f0f0', textDecoration: 'none',
          }}>
            View SDK docs
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: '80px 48px', maxWidth: 860, position: 'relative', zIndex: 1 }}>
        <p style={{ ...mono, fontSize: 10, color: '#5a5a5a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 40 }}>
          How it works
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            { n: '01', title: 'Issue a key', body: 'Create an API key from your dashboard and hand it to your agent.' },
            { n: '02', title: 'Embed the SDK', body: 'Call sdk.run() before every action. Takes ~10ms. No extra infra.' },
            { n: '03', title: 'Audit everything', body: 'Every request is logged. Revoke keys instantly from the dashboard.' },
          ].map(({ n, title, body }) => (
            <div key={n} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid #1c1c1c',
              borderRadius: 12, padding: 24,
            }}>
              <p style={{ ...mono, fontSize: 10, color: '#c8f542', marginBottom: 12 }}>{n}</p>
              <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>{title}</h3>
              <p style={{ ...mono, fontSize: 11, color: '#5a5a5a', lineHeight: 1.7 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
